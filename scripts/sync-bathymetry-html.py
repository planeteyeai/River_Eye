"""Sync public/asset/mula-mutha-bathymetry.html from the vendor S3 messaging drop.

The page is fully self-contained (embedded depth grid, land cover, chainage JSON).
No API prefixing is required for localhost iframe use.

After download, applies RiverEye fullscreen map layout
(scripts/patch-bathymetry-fullscreen.py).
"""
from __future__ import annotations

import importlib.util
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "asset" / "mula-mutha-bathymetry.html"
SRC_URL = (
    "https://ems-storage-123.s3.amazonaws.com/files/messaging/"
    "d514d4e6c6f5413bb48702cda1be7765.html"
)


def apply_fullscreen_patch():
    patch_path = ROOT / "scripts" / "patch-bathymetry-fullscreen.py"
    spec = importlib.util.spec_from_file_location("patch_bathy", patch_path)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    OUT.write_text(mod.apply_patch(OUT.read_text(encoding="utf-8")), encoding="utf-8")
    print("applied fullscreen patch")


def main():
    req = urllib.request.Request(SRC_URL, headers={"User-Agent": "RiverEye/1.0"})
    html = urllib.request.urlopen(req, timeout=120).read().decode("utf-8", "replace")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print("wrote", OUT, "bytes", OUT.stat().st_size)
    apply_fullscreen_patch()


if __name__ == "__main__":
    main()
