import asyncio
import websockets
import json
import logging

logging.basicConfig(level=logging.INFO)

async def handler(websocket):
    logging.info("WebSocket connected from %s", websocket.remote_address)
    
    # Example payload to simulate what the CLI might send
    sample_payload = {
        "action": "submit",
        "task_screen_name": "abc300_a",
        "language_id": "5001",
        "source_code": "print('Hello World')"
    }

    try:
        # Wait for a little bit to simulate the extension connecting, then send a message
        await asyncio.sleep(2)
        message = json.dumps(sample_payload)
        logging.info("Sending payload: %s", message)
        await websocket.send(message)
        
        # Keep connection open indefinitely for testing
        while True:
            await asyncio.sleep(1)
            
    except websockets.exceptions.ConnectionClosed as e:
        logging.info("WebSocket connection closed: %s", e)
    except Exception as e:
        logging.error("WebSocket error: %s", e)

async def main():
    # Start the server on localhost:8080
    logging.info("Starting WebSocket server on ws://localhost:8080...")
    target = websockets.serve(handler, "localhost", 8080)
    async with target:
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
