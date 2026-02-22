import socket
import json
import os
import sys

def guess_contest_and_task(path):
    # Very simple directory-based parsing for now.
    # Ex: /home/cube/abc036/abc036_a -> contest: abc036, task: abc036_a
    # This will be refined later!
    abs_path = os.path.abspath(path)
    parts = abs_path.split(os.sep)
    
    task_screen_name = parts[-1]
    contest_id = parts[-2]
    
    return contest_id, task_screen_name

def submit_code(args):
    src_path = args.src
    
    try:
        with open(src_path, "r", encoding="utf-8") as f:
            source_code = f.read()
    except Exception as e:
        print(f"[CLI] Error: Failed to read {src_path} -> {e}")
        sys.exit(1)

    # If the user didn't specify --contest or --task, we guess from the directory path
    cwd = os.getcwd()
    contest_id = args.contest
    task_screen_name = args.task
    
    if not contest_id or not task_screen_name:
        guessed_contest, guessed_task = guess_contest_and_task(cwd)
        contest_id = contest_id or guessed_contest
        task_screen_name = task_screen_name or guessed_task
        print(f"[CLI] Guessed Context -> Contest: {contest_id}, Task: {task_screen_name}")

    payload = {
        "action": "submit",
        "contest_id": contest_id,
        "task_screen_name": task_screen_name,
        "language_id": args.lang,
        "source_code": source_code
    }

    send_to_native_host(payload)

def send_to_native_host(payload):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect(('127.0.0.1', 49153))
        
        s.sendall(json.dumps(payload).encode('utf-8'))
        
        while True:
            data = s.recv(4096)
            if not data:
                break
            
            for line in data.decode('utf-8').split('\n'):
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
