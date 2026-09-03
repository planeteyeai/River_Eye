#!/usr/bin/env python3
"""Convert Mula–Mutha FABDEM DTM GeoTIFF to web assets.

Reads a float32 GeoTIFF (WGS84) and writes:
  public/asset/mula-mutha-dtm.bin   — row-major Float32LE elevations (m)
  public/asset/mula-mutha-dtm.json  — bounds, size, elevation range
  public/asset/mula-mutha-dtm.tif   — copy of the source GeoTIFF

Usage:
  python scripts/convert-fabdem-dtm.py path/to/FABDEM_DTM_FINAL.tif
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import numpy as np
import tifffile

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "asset"


def convert(src: Path) -> None:
    with tifffile.TiffFile(src) as tif:
        page = tif.pages[0]
        arr = page.asarray().astype(np.float32)
        sx, sy, _ = page.tags["ModelPixelScaleTag"].value
        _, _, _, lon0, lat0, _ = page.tags["ModelTiepointTag"].value

    height, width = arr.shape
    west, north = float(lon0), float(lat0)
    east = west + width * float(sx)
    south = north - height * float(sy)
    vmin = float(np.nanmin(arr))
    vmax = float(np.nanmax(arr))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bin_path = OUT_DIR / "mula-mutha-dtm.bin"
    arr.tofile(bin_path)
    shutil.copy2(src, OUT_DIR / "mula-mutha-dtm.tif")

    meta = {
        "id": "mula-mutha-fabdem-dtm",
        "label": "Mula-Mutha FABDEM DTM",
        "source": src.name,
        "product": "FABDEM",
        "crs": "EPSG:4326",
        "width": width,
        "height": height,
        "dtype": "float32",
        "byte_order": "little",
        "nodata": None,
        "elevation_min_m": round(vmin, 3),
        "elevation_max_m": round(vmax, 3),
        "elevation_unit": "m",
        "pixel_size_deg": float(sx),
        "bounds": {
            "west": west,
            "south": south,
            "east": east,
            "north": north,
        },
        "coordinates": [
            [west, north],
            [east, north],
            [east, south],
            [west, south],
        ],
        "bin": "/asset/mula-mutha-dtm.bin",
        "ui_label": "Estimated",
        "caveat": (
            "Bathtub inundation against FABDEM elevations. Not a hydraulic flood "
            "model; embankments, drains and connectivity are ignored."
        ),
    }
    (OUT_DIR / "mula-mutha-dtm.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {bin_path} ({bin_path.stat().st_size} bytes)")
    print(f"elev {vmin} … {vmax} m · {width}×{height}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    convert(Path(sys.argv[1]))
