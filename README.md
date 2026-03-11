# atcoder-tools-mini (atm)

`atcoder-tools-mini` (abbreviated as `atm`) is a CLI tool designed to automate your AtCoder workflow.

It serves as a deeply modernized and self-contained alternative to the original `atcoder-tools`. By pairing with a dedicated Chrome Extension, it leverages your browser's existing authenticated session to seamlessly interact with AtCoder, maintaining a completely local, frictionless CLI experience.

## Key Features

-  Auto Generation (`gen`): Instantly creates a workspace with problem directories, downloads sample test cases, and injects your favorite code template.
-  Robust Local Testing (`test`): Compiles and tests your code against sample cases locally. Intelligently ignores trailing whitespaces and empty lines to prevent frustrating and unreasonable WAs.
-  One-Command Submission (`ts` / `submit`): Submit directly from the CLI. The tool automatically infers the contest, task, and language context. Track real-time judging status right in your terminal!
-  Deep Customization: Supports multiple programming languages natively and allows infinite customization of compilation/execution commands via `~/.atm_config.json`.
-  Tab-Sync Fallback: Effortlessly test and submit from *any* directory. If your CLI lacks context or test cases, `atm` magically infers the contest and problem ID directly from your active browser tab, extracting and running sample cases in a temporary room on the fly!
-  Browser Integration (Cloudflare Bypass): Uses a Chrome Extension with Native Messaging to securely download contest cases and submit code using your active browser session. This ensures stable and reliable communication with AtCoder directly from your terminal, elegantly bypassing Cloudflare 403 blocks!

---

## Installation

To use `atm`, you need to set up both the CLI tool and the accompanying Chrome Extension.

### 1. Install the CLI
Inside the `cli` directory, install the Python package:
```bash
cd cli
pip install -e .
```
*(This makes the `atm` command available globally in your terminal).*

### 2. Configure Native Messaging for Chrome
The CLI communicates securely with the Chrome extension. Register the native host:
```bash
python install_native.py
```

### 3. Load the Chrome Extension
1. Open Google Chrome and go to `chrome://extensions/`.
2. Enable **"Developer mode"** in the top right corner.
3. Click **"Load unpacked"** and select the `extension` folder from this project.
4. **Restart Chrome** immediately after installation to ensure the Native Host registry is fully detected.

---

## Usage

### 1. Generate Workspace (`atm gen`)
Run this the moment a contest starts to download all test cases and prepare your environment.

```bash
atm gen <contest_id>
# Example: atm gen abc300
# Or simply type `atm gen` to let Tab-Sync Fallback infer the contest from your active Chrome tab.
```
- **What it does**: Scrapes AtCoder, creates a folder for the contest (e.g., `abc300/A`, `abc300/B`), downloads `in_*.txt` & `out_*.txt` sample files, and generates a code file (e.g., `main.cpp` or `main.py`) using your template.
- **Safety**: If the directory already exists, it will safely abort to prevent overwriting your hard work.
- **Custom Template**: You can temporarily specify a template via `atm gen abc300 -t /path/to/template.cpp`.
- **Auto-Open Page (`--open`)**: Automatically open the problem page in your browser immediately after generating the workspace (or if the workspace already exists)!
  - `atm gen abc300 --open A`: Opens the A problem page.
  - `atm gen abc300 --open tasks`: Opens the task list page.
  - `atm gen abc300 --open`: Uses the `default_open` value from your `.atm_config.json` (defaults to `A`).

### 2. Local Testing (`atm test`)
Test your code quickly against the downloaded sample cases.

```bash
# Inside a task directory (e.g., abc300/A)
atm test
# Or specify a file: atm test main.py
```
- **What it does**: Automatically determines the language from the file extension, compiles the code (if needed), and runs it against the `in/` and `out/` directories.
- **Forgiving Comparison**: Strips trailing whitespaces and unnecessary newlines so you won't get a WA for a trivial formatting difference.
- **Output**: Beautifully formatted terminal output showing `PASSED`, `WA`, `RE`, or `TLE`.

### 3. Test & Submit (`atm ts`)  *RECOMMENDED*
The ultimate time-saver during a contest.

```bash
atm ts
```
- **What it does**: First runs `atm test`. If **and only if** all sample cases pass (`PASSED`), it automatically submits the code to AtCoder.
- **Tab-Sync Fallback**: If you run this from a directory without test cases, `atm` instantly extracts the samples from the problem page you are currently viewing in Chrome. It safely tests your code in a hidden temporary folder before automatically cleaning up and submitting everything.
- **Safety**: If even a single test fails, the submission is aborted, saving you from a 5-minute WA penalty!

### 4. Force Submit (`atm submit`)
Submit code immediately without running local tests.

```bash
atm submit
```
- **Context Inference**: It automatically guesses the Contest ID, Task, and Language ID from the `metadata.json` generated by `atm gen`. You almost never need to specify them manually!

---

## Configuration (`~/.atm_config.json`)

You can deeply customize `atm` by creating a `.atm_config.json` file in your home directory (`~/.atm_config.json`). This allows you to set your default language, template, and even override compilation commands.

**Example `~/.atm_config.json`**:
```json
{
    "lang": "python",
    "template_path": "~/my_atcoder_template.py",
    "gen": {
        "default_open": "A"
    },
    "test_commands": {
        "python": {
            "run": "python3 {src}"
        },
        "cpp": {
            "compile": "clang++ -std=c++20 -O3 {src} -o {exec}"
        }
    }
}
```

### Supported Languages (Defaults)
By default, `atm` supports and can auto-detect the following languages based on file extensions:
- `cpp` (.cpp, .cc, .cxx)
- `python` (.py)
- `pypy` (.py - requires config override or manual flag)
- `rust` (.rs)
- `java` (.java)
- `go` (.go)
- `c` (.c)
- `csharp` (.cs)
- `ruby` (.rb)
- `javascript` (.js)
- `typescript` (.ts)
