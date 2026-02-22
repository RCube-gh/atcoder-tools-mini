import os
import sys
import platform
import subprocess
import json

EXTENSION_ID = "dchaoieenkflbnebhapeeikenkcgphdh"
HOST_NAME = "com.atcoder_tools_mini"

def check_wsl():
    if sys.platform != "linux":
        return False
    if "microsoft" in platform.release().lower() or "wsl" in platform.release().lower():
        return True
    return False

def win_path(wsl_path):
    try:
        res = subprocess.check_output(["wslpath", "-w", wsl_path])
        return res.decode('utf-8').strip()
    except Exception:
        return ""

def main():
    base_dir = os.path.abspath(os.path.dirname(__file__))
    native_py = os.path.join(base_dir, "native_host.py")
    
    # Make sure python script is executable
    os.chmod(native_py, 0o755)
    
    if check_wsl():
        print("[Install] Detected WSL environment. Setting up for Windows browsers...")
        bat_path = os.path.join(base_dir, "native_host.bat")
        # Write .bat file for Windows Chrome to bridge to WSL python
        with open(bat_path, "w") as f:
            f.write(f"@echo off\r\n")
            f.write(f"wsl.exe -e python3 {native_py}\r\n")
            
        win_bat_path = win_path(bat_path)
        win_manifest_path = win_path(os.path.join(base_dir, "manifest_win.json"))
        
        manifest = {
            "name": HOST_NAME,
            "description": "AtCoder Tools Mini Native Host",
            "path": win_bat_path,
            "type": "stdio",
            "allowed_origins": [f"chrome-extension://{EXTENSION_ID}/"]
        }
        
        with open(os.path.join(base_dir, "manifest_win.json"), "w") as f:
            json.dump(manifest, f, indent=4)
            
        print(f"[Install] Adding registry keys to Windows for Chrome and Edge...")
        cmds = [
            f'REG ADD "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\{HOST_NAME}" /ve /t REG_SZ /d "{win_manifest_path}" /f',
            f'REG ADD "HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\{HOST_NAME}" /ve /t REG_SZ /d "{win_manifest_path}" /f'
        ]
        for cmd in cmds:
            try:
                subprocess.run(["powershell.exe", "-Command", cmd], capture_output=True)
            except Exception as e:
                print(f"[Error] Could not add registry key: {e}")
                
        print("[Install] Done! Please completely restart your browser (close all windows) to apply Native Messaging.")
        
    else:
        print("[Install] Detected Linux environment. Setting up for Linux browsers...")
        manifest = {
            "name": HOST_NAME,
            "description": "AtCoder Tools Mini Native Host",
            "path": native_py,
            "type": "stdio",
            "allowed_origins": [f"chrome-extension://{EXTENSION_ID}/"]
        }
        dest_dirs = [
            os.path.expanduser("~/.config/google-chrome/NativeMessagingHosts"),
            os.path.expanduser("~/.config/chromium/NativeMessagingHosts"),
            os.path.expanduser("~/.config/microsoft-edge/NativeMessagingHosts")
        ]
        
        for d in dest_dirs:
            os.makedirs(d, exist_ok=True)
            with open(os.path.join(d, f"{HOST_NAME}.json"), "w") as f:
                json.dump(manifest, f, indent=4)
        print("[Install] Done! Please completely restart your browser to apply Native Messaging.")

if __name__ == "__main__":
    main()
