# AtCoder Tools Mini

A streamlined set of tools designed for seamless AtCoder code submission through a local CLI and Chrome Extension integration. This project was created to bypass the Cloudflare limitations when submitting code directly via scripts, by securely utilizing the active browser session.

## Architecture
This tool uses a two-part architecture powered by Chrome Native Messaging:
1. **Local CLI (`cli/`)**: A Python-based command-line package. Once installed natively, it provides the powerful `atm` command. When you submit via `atm submit`, it acts as a lightweight TCP client that sends your code context to a background Native Messaging Host.
2. **Chrome Extension (`extension/`)**: A background service worker installed in Chrome. It connects directly to the Native Messaging Host (`native_host.py`). This allows the extension to wake up securely and perform submissions directly via real HTTP fetches to AtCoder's API, without stealing focus or fighting with browser runtime throttling rules.

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

### 4. Install the Local CLI tool (`atm` command)
Finally, install the Python CLI side in "editable" mode so you can use the `atm` command anywhere on your file system:
```bash
cd cli
pip install -e .
```

## Usage

Navigate to your workspace directory (for example, `/home/cube/abc443/abc443_a/`) and simply run:
```bash
atm submit main.cpp
```
_Because the tool guesses the contest_id (`abc443`) and task screen name (`abc443_a`) straight from the folder names, you never have to type them manually!_

This command will send your code through the Native Host directly into the browser, silently open the submission page in a background tab, submit it, and send the exact JSON judgement status back to your terminal, complete with desktop notifications natively!
