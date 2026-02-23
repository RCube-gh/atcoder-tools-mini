import socket
import json
import os
import sys

def colorize_msg(msg):
    import re
    msg = re.sub(r'\b(Successfully|Success)\b', r'\033[92m\1\033[0m', msg)
    msg = msg.replace("Download complete!", "\033[92mDownload complete!\033[0m")
    msg = re.sub(r'\b(Warning)\b', r'\033[93m\1\033[0m', msg)
    msg = re.sub(r'\b(Error|Failed)\b', r'\033[91m\1\033[0m', msg)
    return msg

def gen_contest(args):
    contest_id = args.contest_id
    cwd = os.getcwd()
    contest_dir = os.path.join(cwd, contest_id)
    
    if os.path.exists(contest_dir):
        print(colorize_msg(f"[CLI] Error: Directory '{contest_dir}' already exists."))
        print(colorize_msg("[CLI] Aborting to prevent overwriting existing files."))
        sys.exit(1)

    payload = {
        "action": "gen",
        "contest_id": contest_id
    }
    
    send_gen_request(payload, cwd=cwd, template_path=args.template)

def send_gen_request(payload, cwd, template_path):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect(('127.0.0.1', 49153))
        
        s.sendall((json.dumps(payload) + "\n").encode('utf-8'))
        
        print(f"[CLI] Requested generation for contest: {payload['contest_id']}")
        
        buffer = ""
        while True:
            data = s.recv(4096)
            if not data:
                break
            
            buffer += data.decode('utf-8')
            while '\n' in buffer:
                line, buffer = buffer.split('\n', 1)
                if not line.strip():
                    continue
                try:
                    msg = json.loads(line)
                    if msg.get("action") == "gen_log":
                        print(colorize_msg(f"[CLI] {msg.get('message')}"))
                    elif msg.get("action") == "gen_error":
                        print(colorize_msg(f"[CLI] Error: {msg.get('error')}"))
                        return
                    elif msg.get("action") == "gen_result":
                        print(colorize_msg("\n[CLI] Download complete! Building workspace..."))
                        build_workspace(msg, cwd, template_path)
                        return
                except json.JSONDecodeError:
                    pass
    except ConnectionRefusedError:
        print(colorize_msg("[CLI] Error: Could not connect to background Native Host."))
        print(colorize_msg("[CLI] Please ensure you have run 'python install_native.py', closed your browser and re-opened it."))

def build_workspace(data, cwd, template_path):
    contest_id = data.get("contest_id")
    tasks = data.get("tasks", [])
    
    contest_dir = os.path.join(cwd, contest_id)
    os.makedirs(contest_dir, exist_ok=True)
    
    # Read config for language and template preferences
    template_content = ""
    lang = "cpp"
    
    config_path = os.path.expanduser("~/.atm_config.json")
    if os.path.isfile(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
                if not template_path and "template_path" in config:
                    template_path = os.path.expanduser(config["template_path"])
                if "lang" in config:
                    lang = config["lang"].lower()
        except Exception as e:
            print(f"[CLI] Warning: Failed to parse {config_path} -> {e}")

    from .lang_map import LANGUAGE_TABLE
    ext = LANGUAGE_TABLE.get(lang, {}).get("extensions", [".cpp"])[0]
    code_filename = f"main{ext}"

    if not template_path:
        default_tpl = os.path.join(os.path.dirname(__file__), "template.cpp")
        if os.path.exists(default_tpl):
            template_path = default_tpl
            
    if template_path and os.path.exists(template_path):
        with open(template_path, "r", encoding="utf-8") as f:
            template_content = f.read()
    else:
        if lang == "cpp":
            template_content = "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n"
        else:
            template_content = ""

    for task in tasks:
        label = task["label"]
        samples = task["samples"]
        
        # A, B, C...
        task_dir = os.path.join(contest_dir, label)
        in_dir = os.path.join(task_dir, "in")
        out_dir = os.path.join(task_dir, "out")
        
        os.makedirs(in_dir, exist_ok=True)
        os.makedirs(out_dir, exist_ok=True)
        
        # Write template
        main_file = os.path.join(task_dir, code_filename)
        if not os.path.exists(main_file):
            with open(main_file, "w", encoding="utf-8") as f:
                f.write(template_content)
        
        for i, sample in enumerate(samples):
            idx = i + 1
            in_file = os.path.join(in_dir, f"in_{idx}.txt")
            out_file = os.path.join(out_dir, f"out_{idx}.txt")
            
            with open(in_file, "w", encoding="utf-8") as f:
                f.write(sample["input"])
            with open(out_file, "w", encoding="utf-8") as f:
                f.write(sample["output"])
        
        # Write metadata.json for atcoder-tools compatibility
        metadata = {
            "code_filename": code_filename,
            "judge": {
                "judge_type": "normal"
            },
            "lang": lang,
            "problem": {
                "alphabet": label,
                "contest": {
                    "contest_id": contest_id
                },
                "problem_id": task["screen_name"]
            },
            "sample_in_pattern": "in_*.txt",
            "sample_out_pattern": "out_*.txt",
            "timeout_ms": 2000
        }
        metadata_file = os.path.join(task_dir, "metadata.json")
        with open(metadata_file, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=1, sort_keys=True)
            f.write("\n")
                
    print(colorize_msg(f"[CLI] Successfully generated workspace at {contest_dir}"))
