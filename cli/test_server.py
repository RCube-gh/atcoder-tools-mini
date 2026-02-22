import json
import logging
import socket
import json
import sys
import argparse

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('src', nargs='?', default="test_data/main.cpp", help="Path to source file")
    args = parser.parse_args()

    try:
        with open(args.src, "r", encoding="utf-8") as f:
            source_code = f.read()
    except Exception as e:
        print(f"[CLI] Failed to read {args.src}: {e}")
        sys.exit(1)

    # In a real tool, contest_id and task_screen_name would be dynamic based on the folder/file
    sample_payload = {
        "action": "submit",
        "contest_id": "abc036",
        "task_screen_name": "abc036_a",
        "language_id": "5001",
        "source_code": source_code
    }

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect(('127.0.0.1', 49153))
        
        # Send the payload to the Native Messaging Host
        s.sendall(json.dumps(sample_payload).encode('utf-8'))
        
        while True:
            data = s.recv(4096)
            if not data:
                break
            
            # data can contain multiple JSON objects separated by newline
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

if __name__ == "__main__":
    main()

