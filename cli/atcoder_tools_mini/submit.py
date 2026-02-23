import socket
import json
import os
import sys

from .lang_map import guess_language_id

def guess_contest_and_task(path):
    # Very simple directory-based parsing for now.
    # Ex: /home/cube/abc036/abc036_a -> contest: abc036, task: abc036_a
    # This will be refined later!
    abs_path = os.path.abspath(path)
    parts = abs_path.split(os.sep)
    
    task_screen_name = parts[-1]
    contest_id = parts[-2]
    
    return contest_id, task_screen_name

def ts_run(args):
    from .test import run_tests
    success = run_tests(args)
    if success:
        print("\n[CLI] Test passed! Auto-submitting...")
        submit_code(args)
    else:
        print("\n[CLI] Tests failed or error occurred. Aborting submission.")
        sys.exit(1)

def submit_code(args):
    src_path = args.src
    
    try:
        with open(src_path, "r", encoding="utf-8") as f:
            source_code = f.read()
    except Exception as e:
        print(f"[CLI] Error: Failed to read {src_path} -> {e}")
        sys.exit(1)

    cwd = os.getcwd()
    
    # Try to load metadata.json
    metadata = {}
    metadata_path = os.path.join(cwd, "metadata.json")
    if os.path.isfile(metadata_path):
        try:
            with open(metadata_path, "r", encoding="utf-8") as f:
                metadata = json.load(f)
        except json.JSONDecodeError:
            print(f"[CLI] Warning: Failed to parse {metadata_path}. Ignoring.")

    # Resolve language ID
    # Priority: 1. explicit option, 2. file extension
    language_id = guess_language_id(args.lang, src_path)
    
    # Priority: 3. metadata.json
    if not language_id and "lang" in metadata:
        metadata_lang = metadata["lang"]
        language_id = guess_language_id(metadata_lang, None)
        
    if not language_id:
        print(f"[CLI] Error: Could not determine Language ID for '{src_path}'.")
        print("Please specify a valid language symbol or ID using '--lang'.")
        sys.exit(1)

    # Resolve Context (contest & task)
    # Priority: 1. explicit option
    contest_id = args.contest
    task_screen_name = args.task
    
    # Priority: 2. metadata.json
    if not contest_id and "problem" in metadata:
        contest_id = metadata["problem"].get("contest", {}).get("contest_id")
    if not task_screen_name and "problem" in metadata:
        task_screen_name = metadata["problem"].get("problem_id")
        
    # Priority: 3. directory guessing
    if not contest_id or not task_screen_name:
        guessed_contest, guessed_task = guess_contest_and_task(cwd)
        contest_id = contest_id or guessed_contest
        task_screen_name = task_screen_name or guessed_task

    print(f"[CLI] Context -> Contest: {contest_id}, Task: {task_screen_name}, Language: {language_id}")

    payload = {
        "action": "submit",
        "contest_id": contest_id,
        "task_screen_name": task_screen_name,
        "language_id": language_id,
        "source_code": source_code
    }

    send_to_native_host(payload)

def send_to_native_host(payload):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect(('127.0.0.1', 49153))
        
        s.sendall(json.dumps(payload).encode('utf-8'))
        
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
                    if msg.get("status") == "submitted":
                        print("\n[CLI] Code submitted successfully! Exiting CLI to let you write the next code.")
                        return
                    elif msg.get("action") == "judge_status":
                        status_info = msg.get("data", {})
                        state = status_info.get("state")
                        status_text = status_info.get("status")
                        score = status_info.get("score", "")
                        time_taken = status_info.get("time", "")
                        
                        if state == "JUDGING":
                            print(f"[CLI] Judging: {status_text}", end='\r', flush=True)
                        elif state == "DONE":
                            print(f"\n[CLI] Judge Complete! Status: {status_text} | Score: {score} | Time: {time_taken}")
                except json.JSONDecodeError:
                    pass
    except ConnectionRefusedError:
        print("[CLI] Error: Could not connect to background Native Host.")
        print("[CLI] Please ensure you have run 'python install_native.py', closed your browser and re-opened it.")
