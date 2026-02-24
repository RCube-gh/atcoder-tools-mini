import argparse
import sys
from .submit import submit_code

def main():
    parser = argparse.ArgumentParser(
        description="atcoder-tools-mini: A lightweight CLI tool for AtCoder automatic submission."
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # 'submit' command
    submit_parser = subparsers.add_parser("submit", help="Submit source code to AtCoder")
    submit_parser.add_argument("src", nargs="?", default="main.cpp", help="Path to source file (default: main.cpp)")
    submit_parser.add_argument("--contest", "-c", help="Contest ID (e.g., abc443). If not provided, it will be guessed from the directory path.")
    submit_parser.add_argument("--task", "-t", help="Task Screen Name (e.g., abc443_a). If not provided, it will be guessed.")
    submit_parser.add_argument("--lang", "-l", help="Language ID (e.g., 5001) or symbol (e.g., cpp, python). If not provided, it will be guessed from the file extension.")
    
    # 'gen' command
    gen_parser = subparsers.add_parser("gen", help="Generate contest workspace and download test cases")
    gen_parser.add_argument("contest_id", nargs="?", default=None, help="Contest ID (e.g., abc443). If omitted, inferred from active browser tab.")
    gen_parser.add_argument("--template", "-t", help="Path to custom template file")
    
    # 'test' command
    test_parser = subparsers.add_parser("test", help="Test source code against sample cases")
    test_parser.add_argument("src", nargs="?", default="main.cpp", help="Path to source file (default: main.cpp)")

    # 'ts' command
    ts_parser = subparsers.add_parser("ts", help="Test source code and submit if all tests pass")
    ts_parser.add_argument("src", nargs="?", default="main.cpp", help="Path to source file (default: main.cpp)")
    ts_parser.add_argument("--contest", "-c", help="Contest ID")
    ts_parser.add_argument("--task", "-t", help="Task Screen Name")
    ts_parser.add_argument("--lang", "-l", help="Language ID or symbol")

    args = parser.parse_args()

    if args.command == "submit":
        submit_code(args)
    elif args.command == "gen":
        from .gen import gen_contest
        gen_contest(args)
    elif args.command == "test":
        from .test import test_code
        test_code(args)
    elif args.command == "ts":
        from .submit import ts_run
        ts_run(args)
    else:
        parser.print_help()
        sys.exit(1)

if __name__ == "__main__":
    main()
