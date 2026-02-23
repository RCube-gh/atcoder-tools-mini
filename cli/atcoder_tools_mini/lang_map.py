LANGUAGE_TABLE = {
    "cpp": {"keywords": ["C++", "GCC"], "extensions": [".cpp", ".cc", ".cxx"]},
    "python": {"keywords": ["Python", "CPython"], "extensions": [".py"]},
    "pypy": {"keywords": ["PyPy3"], "extensions": [".py"]},
    "rust": {"keywords": ["Rust", "rustc"], "extensions": [".rs"]},
    "java": {"keywords": ["Java"], "extensions": [".java"]},
    "go": {"keywords": ["Go "], "extensions": [".go"]},
    "c": {"keywords": ["C ", "GCC"], "extensions": [".c"]},
    "csharp": {"keywords": ["C#", ".NET Native AOT"], "extensions": [".cs"]},
    "ruby": {"keywords": ["Ruby "], "extensions": [".rb"]},
    "js": {"keywords": ["JavaScript"], "extensions": [".js"]},
    "ts": {"keywords": ["TypeScript"], "extensions": [".ts"]},
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
