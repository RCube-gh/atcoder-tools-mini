# AtCoder Tools Mini

A streamlined set of tools designed for seamless AtCoder code submission through a local CLI and Chrome Extension integration. This project was created to bypass the Cloudflare limitations when submitting code directly via scripts, by securely utilizing the active browser session.

## Architecture
This tool uses a two-part architecture powered by Chrome Native Messaging:
1. **Local CLI (`cli/`)**: A Python-based command-line interface. When you submit, it acts as a lightweight TCP client that sends your code to a background Native Messaging Host.
2. **Chrome Extension (`extension/`)**: A background service worker installed in Chrome. It connects directly to the Native Messaging Host (`native_host.py`). This allows the extension to wake up securely and perform submissions in the background, without stealing focus or fighting with browser security rules.

## Setup

### 1. Load the Chrome Extension
1. Open Google Chrome (or Edge) and go to `chrome://extensions/`
2. Enable **Developer mode** in the top right.
3. Click "Load unpacked" and select the `extension/` directory of this project.
4. Note the Extension ID generated (e.g. `dchaoieenkflbnebhapeeikenkcgphdh`). The scripts expect this specific ID, so ensure the folder path does not change.

### 2. Install Native Messaging Host
Because the extension uses Native Messaging to securely talk to your local file system without polling or WebSocket spam, you MUST install the native host manifest into your OS registry/config.

From your terminal (Linux or WSL), simply run:
```bash
python3 cli/install_native.py
```
*(If you are on WSL, this script will automatically use PowerShell to add the necessary Windows Registry keys for Chrome and Edge.)*

### 3. Restart Browser
**Important:** You MUST completely close and reopen your browser (Chrome/Edge) for Native Messaging to take effect. If you have any Chrome apps running in the background, kill them from the system tray as well.

## Usage

Simply run:
```bash
python3 cli/test_server.py
```
This will send your code through the Native Host directly into the browser, silently opening the submission page in the background, submitting it, and sending the exact judgement status back to your terminal and desktop notifications natively!
