LANGUAGE_TABLE = {
    "cpp": {
        "keywords": ["C++", "GCC"], 
        "extensions": [".cpp", ".cc", ".cxx"],
        "compile": ["g++", "-std=gnu++20", "-Wall", "-Wextra", "-O2", "{src}", "-o", "{exec}"],
        "run": ["./{exec}"]
    },
    "python": {
        "keywords": ["Python", "CPython"], 
        "extensions": [".py"],
        "compile": None,
        "run": ["python3", "{src}"]
    },
    "pypy": {
        "keywords": ["PyPy3"], 
        "extensions": [".py"],
        "compile": None,
        "run": ["pypy3", "{src}"]
    },
    "rust": {
        "keywords": ["Rust", "rustc"], 
        "extensions": [".rs"],
        "compile": ["rustc", "-O", "{src}", "-o", "{exec}"],
        "run": ["./{exec}"]
    },
    "java": {
        "keywords": ["Java"], 
        "extensions": [".java"],
        "compile": ["javac", "{src}"],
        "run": ["java", "{basename}"]
    },
    "go": {
        "keywords": ["Go "], 
        "extensions": [".go"],
        "compile": ["go", "build", "-o", "{exec}", "{src}"],
        "run": ["./{exec}"]
    },
    "c": {
        "keywords": ["C ", "GCC"], 
        "extensions": [".c"],
        "compile": ["gcc", "-std=gnu11", "-Wall", "-Wextra", "-O2", "{src}", "-o", "{exec}"],
        "run": ["./{exec}"]
    },
    "csharp": {
        "keywords": ["C#", ".NET Native AOT"], 
        "extensions": [".cs"],
        "compile": ["csc", "-nologo", "-out:{exec}.exe", "{src}"],
        "run": ["./{exec}.exe"]
    },
    "ruby": {
        "keywords": ["Ruby "], 
        "extensions": [".rb"],
        "compile": None,
        "run": ["ruby", "{src}"]
    },
    "js": {
        "keywords": ["JavaScript"], 
        "extensions": [".js"],
        "compile": None,
        "run": ["node", "{src}"]
    },
    "ts": {
        "keywords": ["TypeScript"], 
        "extensions": [".ts"],
        "compile": ["tsc", "{src}"],
        "run": ["node", "{exec}.js"]
    },
}

def guess_language_id(args_lang, src_path):
    """
    Determine the language keywords or ID based on user argument or file extension.
    Returns: list of strings (keywords) or string (exact ID), or None if it cannot be determined.
    """
    # 1. If explicit --lang is provided
    if args_lang:
        # If it's pure digits, assume it's an exact ID
        if args_lang.isdigit():
            return args_lang
        
        # If it's a symbol like 'cpp' or 'python'
        symbol = args_lang.lower()
        if symbol in LANGUAGE_TABLE:
            return LANGUAGE_TABLE[symbol]["keywords"]
        
        # Unknown symbol provided
        return None

    # 2. If --lang is not provided, guess from file extension
    import os
    _, ext = os.path.splitext(src_path)
    ext = ext.lower()
    
    for symbol, info in LANGUAGE_TABLE.items():
        if ext in info["extensions"]:
            return info["keywords"]
            
    # Cannot guess
    return None
