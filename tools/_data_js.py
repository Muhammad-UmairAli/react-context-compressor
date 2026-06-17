"""_data_js.py — shared helper: regenerate a window-global JS file from a JSON source.

Not a CLI tool; imported by log-time.py, log-agent.py, open-phase.py, etc.

Usage:
    from tools._data_js import regen_js
    regen_js(json_path, js_path, "TIME_LOG_DATA")
"""

import json
from pathlib import Path


def regen_js(json_path: Path, js_path: Path, var_name: str) -> None:
    """Read JSON from json_path and write window.<var_name> = <json>; to js_path."""
    data = json.loads(json_path.read_text(encoding="utf-8"))
    js = f"window.{var_name} = {json.dumps(data, indent=2, ensure_ascii=False)};\n"
    js_path.write_text(js, encoding="utf-8")
