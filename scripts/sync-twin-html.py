"""Sync public/asset/mula-mutha-twin.html from the live Railway dashboard.

The hosted twin page uses relative /api/* paths. When bundled and loaded
from the River Eye iframe we prefix the Railway origin so fetches work.
"""
from __future__ import annotations

import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "asset" / "mula-mutha-twin.html"
SRC_URL = "https://riverdigitaltwin-production.up.railway.app/"
API = "https://riverdigitaltwin-production.up.railway.app"

MAP_CSS = """
  #map{height:380px;border-radius:8px}
  .maplegend{font-size:12px;color:var(--muted);margin-top:6px}
  .maplegend span{display:inline-block;margin-right:14px}
  .swatch{display:inline-block;width:18px;height:3px;margin-right:5px;vertical-align:2px}
"""


def main():
    html = urllib.request.urlopen(SRC_URL, timeout=30).read().decode("utf-8", "replace")

    if 'const API="' not in html:
        html = html.replace(
            'const GOOGLE_MAPS_API_KEY = "";',
            f'const API="{API}";\nconst GOOGLE_MAPS_API_KEY = "";',
            1,
        )

    html = re.sub(
        r"async function j\(u,opt\)\{const r=await fetch\(u,opt\);return r\.json\(\);\}",
        'async function j(u,opt){const url=u.startsWith("http")?u:API+u;'
        "const r=await fetch(url,opt);return r.json();}",
        html,
        count=1,
    )

    if "#map{height:" not in html:
        html = html.replace(
            "  .leaflet-div-icon{background:transparent!important;border:none!important}",
            MAP_CSS.strip()
            + "\n  .leaflet-div-icon{background:transparent!important;border:none!important}",
            1,
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print("wrote", OUT, "bytes", OUT.stat().st_size)


if __name__ == "__main__":
    main()
