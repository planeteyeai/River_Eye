import json
import subprocess
from pathlib import Path

TRANSCRIPT = Path(
    r"C:\Users\Kunal.Desale\.cursor\projects\c-Users-Kunal-Desale-Downloads-frontend-ClimateEye-frontend-ClimateEye"
    r"\agent-transcripts\e8359264-0978-44ed-9393-99b2fb301d03\e8359264-0978-44ed-9393-99b2fb301d03.jsonl"
)
ROOT = Path(r"c:\Users\Kunal.Desale\Downloads\frontend-ClimateEye\frontend-ClimateEye")
MAX_LINE = 2514

TARGETS = {
    "scripts/sync-twin-html.py",
    "src/components/MapComponent.jsx",
    "src/components/Dashboard.jsx",
    "src/components/MapViewsControl.jsx",
    "src/lib/layerLegends.js",
    "src/data/monitoringThemes.js",
    "src/components/ChainageScrubber.css",
}


def norm_path(p: str) -> str:
    p = p.replace("\\", "/")
    marker = "frontend-ClimateEye/frontend-ClimateEye/"
    if marker in p:
        p = p.split(marker, 1)[1]
    root = str(ROOT).replace("\\", "/")
    if p.lower().startswith(root.lower() + "/"):
        p = p[len(root) + 1 :]
    return p


def git_head(rel: str) -> str | None:
    try:
        return subprocess.check_output(
            ["git", "show", f"HEAD:{rel}"], cwd=ROOT, text=True, stderr=subprocess.DEVNULL
        )
    except subprocess.CalledProcessError:
        return None


files: dict[str, str] = {}
failed: list[tuple] = []

with open(TRANSCRIPT, "r", encoding="utf-8") as f:
    for line_no, line in enumerate(f, 1):
        if line_no > MAX_LINE:
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
                old = inp.get("old_string", "")
                new = inp.get("new_string", "")
                if rel not in files:
                    files[rel] = git_head(rel) or (ROOT / rel).read_text(encoding="utf-8")
                if old not in files[rel]:
                    failed.append((line_no, rel, old[:80]))
                    continue
                files[rel] = files[rel].replace(old, new, 1)

out_dir = ROOT / "tmp-transcript-extract"
out_dir.mkdir(exist_ok=True)
for rel, content in files.items():
    out = out_dir / rel.replace("/", "__")
    out.write_text(content, encoding="utf-8")
    print(f"{rel}: {len(content)} chars")

print(f"\nFailed: {len(failed)}")
for item in failed:
    print(f"  line {item[0]} {item[1]}: {item[2]!r}...")

for t in TARGETS:
    if t not in files:
        print(f"MISSING: {t}")
