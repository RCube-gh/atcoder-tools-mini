import json
import logging
import os
import sys
import webbrowser
from flask import Flask, request, jsonify
from flask_cors import CORS

logging.basicConfig(level=logging.ERROR) # hide flask logs
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__)
CORS(app)

# Read the main.cpp file that the user prepared
try:
    with open("test_data/main.cpp", "r", encoding="utf-8") as f:
        source_code = f.read()
except Exception as e:
    print(f"[CLI] Failed to read test_data/main.cpp: {e}")
    sys.exit(1)

# Payload matching the test URL: https://atcoder.jp/contests/abc446/tasks/abc446_a
sample_payload = {
    "action": "submit",
    "contest_id": "abc446",
    "task_screen_name": "abc446_a",
    "language_id": "5001",
    "source_code": source_code
}

@app.route('/submit_data', methods=['GET'])
def get_submit_data():
    return jsonify(sample_payload)

@app.route('/submit_status', methods=['POST'])
def post_submit_status():
    data = request.json
    status = data.get("status")
    
    if status == 'submitted':
        print("[CLI] Code submitted successfully! Exiting CLI to let you write the next code.")
        # shutdown flask graceful
        os._exit(0)
    
    return jsonify({"received": True})


if __name__ == "__main__":
    print("[CLI] Starting local submission sequence...")
    # Trigger the browser to open the custom URL that wakes up our extension!
    target_url = "https://atcoder.jp/contests/abc446/submit?local_submit=true"
    
    # Use WSL specific open or fallback to webbrowser
    if 'microsoft' in os.uname().release.lower():
        os.system(f'wslview "{target_url}" &')
    else:
        webbrowser.open(target_url)
        
    print("[CLI] Waiting for extension to retrieve code and submit...")
    app.run(host="127.0.0.1", port=49153)
