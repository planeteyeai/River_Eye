import json
import subprocess
from pathlib import Path

TRANSCRIPT = Path(
    r"C:\Users\Kunal.Desale\.cursor\projects\c-Users-Kunal-Desale-Downloads-frontend-ClimateEye-frontend-ClimateEye"
    r"\agent-transcripts\e8359264-0978-44ed-9393-99b2fb301d03\e8359264-0978-44ed-9393-99b2fb301d03.jsonl"
)
ROOT = Path(r"c:\Users\Kunal.Desale\Downloads\frontend-ClimateEye\frontend-ClimateEye")

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


def git_head(rel):
    try:
        return subprocess.check_output(["git", "show", f"HEAD:{rel}"], cwd=ROOT, text=True, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        return None


def replay(max_line):
    files = {}
    failed = 0
    with open(TRANSCRIPT, "r", encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            if line_no > max_line:
                break
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
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
                if name == "Write":
                    files[rel] = inp.get("contents", "")
                else:
                    old, new = inp.get("old_string", ""), inp.get("new_string", "")
                    if rel not in files:
                        files[rel] = git_head(rel) or (ROOT / rel).read_text(encoding="utf-8")
                    if old in files[rel]:
                        files[rel] = files[rel].replace(old, new, 1)
                    else:
                        failed += 1
    return files, failed


# Replay in two phases: up to 2369 then 2370-2514
files2369, f1 = replay(2369)
files2514, f2 = replay(2514)

out = ROOT / "tmp-transcript-extract"
out.mkdir(exist_ok=True)
for rel in TARGETS:
    if rel in files2514:
        (out / rel.replace("/", "__")).write_text(files2514[rel], encoding="utf-8")
        print(f"{rel}: {len(files2514[rel])} chars (failed total ~{f2})")

# MapComponent specific check
mc = files2514.get("src/components/MapComponent.jsx", "")
for needle in ["NDSI_SALINITY", "raiseChainageToTop", "CHAINAGE_STACK", "GARBAGE", "WRD_LINE", "tributaryJunctions"]:
    print(f"  MapComponent has {needle}: {needle in mc}")
