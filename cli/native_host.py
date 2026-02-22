#!/usr/bin/env python3
import sys
import json
import struct
import threading
import socket
import logging
import os

LOG_FILE = os.path.expanduser('~/.atcoder_tools_mini_native.log')
logging.basicConfig(filename=LOG_FILE, level=logging.INFO)

clients = []

def send_message(msg_dict):
    try:
        msg = json.dumps(msg_dict).encode('utf-8')
        sys.stdout.buffer.write(struct.pack('@I', len(msg)))
        sys.stdout.buffer.write(msg)
        sys.stdout.buffer.flush()
    except Exception as e:
        logging.error("Failed to send message to Chrome: %s", e)

def read_messages():
    while True:
        try:
            raw_length = sys.stdin.buffer.read(4)
            if len(raw_length) == 0:
                logging.info("EOF from stdin. Exiting.")
                sys.exit(0)
            msg_length = struct.unpack('@I', raw_length)[0]
            message = sys.stdin.buffer.read(msg_length).decode('utf-8')
            logging.info("Received from extension: %s", message)
            
            # broadcast to CLI clients
            msg_bytes = message.encode('utf-8') + b'\n'
            for c in list(clients):
                try:
                    c.sendall(msg_bytes)
                except Exception as e:
                    logging.error("Failed to send to client: %s", e)
                    clients.remove(c)
        except Exception as e:
            logging.error("Error reading from stdin: %s", e)
            sys.exit(1)

def socket_server():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    
    try:
        server.bind(('127.0.0.1', 49153))
        server.listen(5)
        logging.info("Socket server listening on port 49153")
    except Exception as e:
        logging.error("Failed to bind: %s", e)
        sys.exit(1)
        
    while True:
        try:
            conn, addr = server.accept()
            logging.info("Client connected from %s", addr)
            clients.append(conn)
            
            data = conn.recv(1024*1024)
            if data:
                payload = json.loads(data.decode('utf-8'))
                logging.info("Received from CLI, sending to extension")
                send_message(payload)
        except Exception as e:
            logging.error("Error handling client: %s", e)

if __name__ == '__main__':
    logging.info("Native host started")
    # Using OS specifically to ensure windows newline translations don't corrupt binary stdout
    if sys.platform == "win32":
        import msvcrt
        msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
        msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)
        
    t = threading.Thread(target=socket_server, daemon=True)
    t.start()
    read_messages()
