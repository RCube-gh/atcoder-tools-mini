import os
import sys
import subprocess
import time
import json
import glob
from .lang_map import LANGUAGE_TABLE

def get_test_commands(args, src_path, metadata):
    symbol_found = None
    
    # Priority 1: explicit option
    if hasattr(args, 'lang') and args.lang:
        args_lang_lower = args.lang.lower()
        if args_lang_lower in LANGUAGE_TABLE:
            symbol_found = args_lang_lower

    # Priority 2: file extension
    if not symbol_found:
        _, ext = os.path.splitext(src_path)
        ext = ext.lower()
        for symbol, info in LANGUAGE_TABLE.items():
            if ext in info["extensions"]:
                symbol_found = symbol
                break

    # Priority 3: metadata.json
    if not symbol_found and metadata and "lang" in metadata:
        meta_lang = metadata["lang"].lower()
        if meta_lang in LANGUAGE_TABLE:
            symbol_found = meta_lang
                
    if not symbol_found:
        print(f"[CLI] \033[91mError: Could not determine language for local testing of '{src_path}'.\033[0m")
        sys.exit(1)
        
    compile_cmd = LANGUAGE_TABLE[symbol_found]["compile"]
    run_cmd = LANGUAGE_TABLE[symbol_found]["run"]
    
    # Try overriding from ~/.atm_config.json
    config_path = os.path.expanduser("~/.atm_config.json")
    if os.path.isfile(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
                if "test_commands" in config and symbol_found in config["test_commands"]:
                    user_cmds = config["test_commands"][symbol_found]
                    if "compile" in user_cmds:
                        compile_cmd = user_cmds["compile"]
                        if isinstance(compile_cmd, str):
                            compile_cmd = compile_cmd.split()
                    if "run" in user_cmds:
                        run_cmd = user_cmds["run"]
                        if isinstance(run_cmd, str):
                            run_cmd = run_cmd.split()
        except Exception as e:
            print(f"[CLI] \033[93mWarning: Failed to parses {config_path} -> {e}\033[0m")
            
    return compile_cmd, run_cmd

def run_tests(args):
    """
    Finds the main.cpp code (or whichever specified), compiles it if needed,
    and runs it against all test cases in the `in/` directory, comparing output
    with the `out/` directory.
    """
    src_path = args.src
    cwd = os.getcwd()
    
    import datetime
    
    # Try to load metadata.json
    metadata = {}
    metadata_path = os.path.join(cwd, "metadata.json")
    if os.path.isfile(metadata_path):
        try:
            with open(metadata_path, "r", encoding="utf-8") as f:
                metadata = json.load(f)
        except json.JSONDecodeError:
            pass
            
    compile_template, run_template = get_test_commands(args, src_path, metadata)
    
    exec_filename = "a.out" if os.name != "nt" else "a.exe"
    file_base = os.path.splitext(os.path.basename(src_path))[0]
    
    if compile_template:
        compile_cmd = [cmd.format(src=src_path, exec=exec_filename, basename=file_base) for cmd in compile_template]
        
        try:
            subprocess.run(compile_cmd, check=True, stderr=subprocess.PIPE, text=True)
        except subprocess.CalledProcessError as e:
            print("[CLI] \033[91mCompilation Failed!\033[0m")
            print(e.stderr)
            return False
            
        dt_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S,%f")[:-3]
        print(f"{dt_str} INFO: Inferred exec file: ./{exec_filename}")
    
    # 2. Find test cases
    # We look for files matching in*.txt in the 'in' directory and out*.txt in the 'out' directory
    in_dir = "in"
    out_dir = "out"
    
    temp_dir_obj = None
    
    if not os.path.isdir(in_dir) or not os.path.isdir(out_dir):
        print("[CLI] \033[93mCurrent directory doesn't have 'in/' or 'out/' folders.\033[0m")
        print("[CLI] \033[96mInitiating Tab-Sync Fallback...\033[0m")
        sys.stdout.flush()
        from .gen import request_current_context
        ctx = request_current_context()
        if not ctx or not ctx.get('samples'):
            print(f"[CLI] \033[91mTab-Sync Fallback failed. Could not find samples in active tab.\033[0m")
            return False
            
        import tempfile
        import shutil
        temp_dir_obj = tempfile.mkdtemp(prefix="atm_cache_")
        in_dir = os.path.join(temp_dir_obj, "in")
        out_dir = os.path.join(temp_dir_obj, "out")
        os.makedirs(in_dir)
        os.makedirs(out_dir)
        
        for i, sample in enumerate(ctx['samples']):
            idx = i + 1
            with open(os.path.join(in_dir, f"in_{idx}.txt"), "w", encoding="utf-8") as f:
                f.write(sample["input"])
            with open(os.path.join(out_dir, f"out_{idx}.txt"), "w", encoding="utf-8") as f:
                f.write(sample["output"])
        print(f"[CLI] Tab-Sync Fallback successful: Extracted {len(ctx['samples'])} samples into temporary secret room.")
        
    try:
        in_files = sorted(glob.glob(os.path.join(in_dir, "*.txt")))
        
        if not in_files:
            print(f"[CLI] \033[93mNo test cases found in '{in_dir}'.\033[0m")
            return True
            
        passed_count = 0
        total_count = len(in_files)
        
        for in_file in in_files:
            basename = os.path.basename(in_file)
            # Expected corresponding output file
            # E.g. in_1.txt -> out_1.txt
            out_name = basename.replace("in", "out")
            out_file = os.path.join(out_dir, out_name)
            
            if not os.path.isfile(out_file):
                print(f"[CLI] \033[93mWarning: Missing expected output file '{out_file}' for input '{basename}'. Skipping.\033[0m")
                continue
                
            with open(in_file, "r", encoding="utf-8") as f:
                sample_in = f.read()
                
            with open(out_file, "r", encoding="utf-8") as f:
                expected_out = f.read()
                
            # Run the program
            start_time = time.time()
            try:
                # Format the run command
                run_cmd = [cmd.format(src=src_path, exec=exec_filename, basename=file_base) for cmd in run_template]
                
                result = subprocess.run(
                    run_cmd,
                    input=sample_in,
                    text=True,
                    capture_output=True,
                    timeout=2.0
                )
                
                elapsed_ms = int((time.time() - start_time) * 1000)
                
                if result.returncode != 0:
                    print(f"# {basename} ... \033[93mRE\033[0m")
                    print(f"[Input]\n{sample_in.strip()}")
                    print(f"[Expected]\n{expected_out.strip()}")
                    print(f"[Received]\n{result.stdout.strip()}")
                    if result.stderr.strip():
                        print(f"[Error]\n{result.stderr.strip()}")
                    print("\n")
                    continue
                    
                actual_out = result.stdout
                
                # Normalize trailing whitespaces for flexible comparison
                def normalize_str(s):
                    lines = s.strip().split('\n')
                    return '\n'.join(line.rstrip() for line in lines)
                    
                norm_actual = normalize_str(actual_out)
                norm_expected = normalize_str(expected_out)
                
                if norm_actual == norm_expected:
                    print(f"# {basename} ... \033[92mPASSED\033[0m {elapsed_ms} ms")
                    passed_count += 1
                    if result.stderr.strip():
                        print(f"[Error]\n{result.stderr.strip()}")
                else:
                    print(f"# {basename} ... \033[91mWA\033[0m")
                    print(f"[Input]\n{sample_in.strip()}")
                    print(f"[Expected]\n{expected_out.strip()}")
                    print(f"[Received]\n{actual_out.strip()}")
                    if result.stderr.strip():
                        print(f"[Error]\n{result.stderr.strip()}")
                    print("\n")
                    
            except subprocess.TimeoutExpired:
                print(f"# {basename} ... \033[93mTLE\033[0m")
                print("\n")
                
        if passed_count == total_count:
            print("\033[92mPassed all test cases!!!\033[0m")
            return True
        else:
            print(f"\033[91mSome cases FAILED (passed {passed_count} of {total_count})\033[0m")
            return False
            
    finally:
        if temp_dir_obj and os.path.exists(temp_dir_obj):
            import shutil
            shutil.rmtree(temp_dir_obj)
            print("[CLI] \033[90mCleaned up temporary secret room.\033[0m")

def test_code(args):
    success = run_tests(args)
    if not success:
        sys.exit(1)
    sys.exit(0)
