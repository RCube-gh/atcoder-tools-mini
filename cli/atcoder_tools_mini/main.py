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
    submit_parser.add_argument("--lang", "-l", default="5001", help="Language ID (default: 5001 for C++)")
    
    args = parser.parse_args()

    if args.command == "submit":
        submit_code(args)
    else:
        parser.print_help()
        sys.exit(1)

if __name__ == "__main__":
    main()
