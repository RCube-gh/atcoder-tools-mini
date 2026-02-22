# AtCoder Tools Mini

A streamlined set of tools designed for seamless AtCoder code submission through a local CLI and Chrome Extension integration. This project was created to bypass the Cloudflare limitations when submitting code directly via scripts, by securely utilizing the active browser session.

## Architecture Architecture
This tool uses a two-part architecture:
1. **Local CLI (`cli/`)**: A Python-based command-line interface running locally (e.g., WSL). It prepares the code, downloads test cases, runs tests, and communicates with the Chrome extension over a local WebSocket server when you're ready to submit.
2. **Chrome Extension (`extension/`)**: A background service worker installed in Chrome. It connects to the local WebSocket server and performs the actual submission to AtCoder by listening to the CLI's request, acting as a secure bridge that naturally passes Cloudflare checks via your existing browser session.

## Setup

- Currently in active development!

## Usage

- Coming soon.
