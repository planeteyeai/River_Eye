import json
from pathlib import Path

TRANSCRIPT = Path(
    r"C:\Users\Kunal.Desale\.cursor\projects\c-Users-Kunal-Desale-Downloads-frontend-ClimateEye-frontend-ClimateEye"
    r"\agent-transcripts\e8359264-0978-44ed-9393-99b2fb301d03\e8359264-0978-44ed-9393-99b2fb301d03.jsonl"
)
OUT = Path(r"c:\Users\Kunal.Desale\Downloads\frontend-ClimateEye\frontend-ClimateEye\tmp-transcript-ops")
OUT.mkdir(exist_ok=True)

TARGETS = {
    "scripts/sync-twin-html.py",
    "src/components/MapComponent.jsx",
    "src/components/Dashboard.jsx",
    "src/components/MapViewsControl.jsx",
    "src/lib/layerLegends.js",
    "src/data/monitoringThemes.js",
    "src/components/ChainageScrubber.css",
}

def norm_path(p):
    p = p.replace("\\", "/")
    m = "frontend-ClimateEye/frontend-ClimateEye/"
    return p.split(m, 1)[1] if m in p else p

with open(TRANSCRIPT, "r", encoding="utf-8") as f:
    for line_no, line in enumerate(f, 1):
        if line_no > 2514:
            break
        try:
            obj = json.loads(line)
        except:
            continue
        for c in obj.get("message", {}).get("content", []):
            if c.get("type") != "tool_use":
                continue
            name = c.get("name", "")
            if name not in ("Write", "StrReplace"):
                continue
            inp = c.get("input", {})
            rel = norm_path(inp.get("path", ""))
            if rel not in TARGETS:
                continue
            fp = OUT / f"{line_no:05d}_{rel.replace('/', '__')}_{name}.txt"
            if name == "Write":
                fp.write_text(inp.get("contents", ""), encoding="utf-8")
            else:
                fp.write_text(
                    "=== OLD ===\n" + inp.get("old_string", "") + "\n\n=== NEW ===\n" + inp.get("new_string", ""),
                    encoding="utf-8",
                )
            print(f"{line_no} {name} {rel} -> {fp.name}")
