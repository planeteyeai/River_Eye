import json
from pathlib import Path

TRANSCRIPT = Path(
    r"C:\Users\Kunal.Desale\.cursor\projects\c-Users-Kunal-Desale-Downloads-frontend-ClimateEye-frontend-ClimateEye"
    r"\agent-transcripts\e8359264-0978-44ed-9393-99b2fb301d03\e8359264-0978-44ed-9393-99b2fb301d03.jsonl"
)
ROOT = Path(r"c:\Users\Kunal.Desale\Downloads\frontend-ClimateEye\frontend-ClimateEye")
MIN_LINE = 2370
MAX_LINE = 2514

TARGETS = [
    "scripts/sync-twin-html.py",
    "src/components/MapComponent.jsx",
    "src/components/Dashboard.jsx",
    "src/components/MapViewsControl.jsx",
    "src/lib/layerLegends.js",
    "src/data/monitoringThemes.js",
    "src/components/ChainageScrubber.css",
]


def norm_path(p):
    p = p.replace("\\", "/")
    m = "frontend-ClimateEye/frontend-ClimateEye/"
    return p.split(m, 1)[1] if m in p else p


files = {}
for rel in TARGETS:
    fp = ROOT / rel
    if fp.exists():
        files[rel] = fp.read_text(encoding="utf-8")

ok, fail = [], []
with open(TRANSCRIPT, "r", encoding="utf-8") as f:
    for line_no, line in enumerate(f, 1):
        if line_no < MIN_LINE:
            continue
        if line_no > MAX_LINE:
            break
        obj = json.loads(line)
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
                ok.append((line_no, rel, "Write"))
            else:
                old, new = inp.get("old_string", ""), inp.get("new_string", "")
                if rel not in files:
                    fail.append((line_no, rel, "no baseline"))
                    continue
                if old in files[rel]:
                    files[rel] = files[rel].replace(old, new, 1)
                    ok.append((line_no, rel, "StrReplace"))
                else:
                    fail.append((line_no, rel, old[:60]))

out = ROOT / "tmp-transcript-extract"
out.mkdir(exist_ok=True)
for rel in TARGETS:
    if rel in files:
        (out / rel.replace("/", "__")).write_text(files[rel], encoding="utf-8")
        print(f"{rel}: {len(files[rel])} chars")

print(f"\nOK: {len(ok)}  FAIL: {len(fail)}")
for x in fail:
    print(f"  FAIL {x[0]} {x[1]}: {x[2]!r}")

mc = files.get("src/components/MapComponent.jsx", "")
for n in ["NDSI_SALINITY", "raiseChainageToTop", "CHAINAGE_STACK", "GARBAGE", "WRD_LINE", "tributaryJunctions", "showNdsiSalinityLayer"]:
    print(f"  {n}: {n in mc}")
