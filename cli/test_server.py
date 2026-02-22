import asyncio
import websockets
import json
import logging

logging.basicConfig(level=logging.INFO)

async def handler(websocket):
    logging.info("WebSocket connected from %s", websocket.remote_address)
    
    # Read the main.cpp file that the user prepared
    try:
        with open("test_data/main.cpp", "r", encoding="utf-8") as f:
            source_code = f.read()
    except Exception as e:
        logging.error("Failed to read test_data/main.cpp: %s", e)
        return

    # Payload matching the test URL: https://atcoder.jp/contests/abc446/tasks/abc446_a
    # C++ (GCC 12.2) language ID is 5001
    sample_payload = {
        "action": "submit",
        "contest_id": "abc446",
        "task_screen_name": "abc446_a",
        "language_id": "5001",
        "source_code": source_code
    }

    try:
        # Wait for a little bit to simulate the extension connecting, then send a message
        await asyncio.sleep(2)
        message = json.dumps(sample_payload)
        logging.info("Sending payload: %s", message)
        await websocket.send(message)
        
        # Keep connection open indefinitely for testing
        while True:
            try:
                message = await websocket.recv()
                logging.info("Received message: %s", message)
                data = json.loads(message)

                if data.get("status") == "connected":
                    print("[CLI] Extension connected successfully.")
                elif data.get("action") == "judge_status":
                    status_info = data.get("data", {})
                    state = status_info.get("state")
                    status_text = status_info.get("status")
                    score = status_info.get("score", "")
                    time_taken = status_info.get("time", "")
                    
                    if state == "JUDGING":
                        print(f"[CLI] Judging: {status_text}", end='\r', flush=True)
                    elif state == "DONE":
                        print(f"\n[CLI] Judge Complete! Status: {status_text} | Score: {score} | Time: {time_taken}")
                elif data.get("status") == "success":
                    print("[CLI] Received success confirmation from extension.")
                else:
                    print(f"[CLI] Received unknown message: {message}")
            except json.JSONDecodeError:
                print(f"[CLI] Received raw text: {message}")
            except websockets.exceptions.ConnectionClosedOK:
                logging.info("WebSocket connection closed normally.")
                break # Exit the loop if connection is closed
            except Exception as e:
                logging.error("Error receiving or processing message: %s", e)
                await asyncio.sleep(1) # Prevent busy-waiting on persistent errors
            
    except websockets.exceptions.ConnectionClosed as e:
        logging.info("WebSocket connection closed: %s", e)
    except Exception as e:
        logging.error("WebSocket error: %s", e)

async def main():
    # Start the server on localhost:49153
    logging.info("Starting WebSocket server on ws://localhost:49153...")
    target = websockets.serve(handler, "localhost", 49153)
    async with target:
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
