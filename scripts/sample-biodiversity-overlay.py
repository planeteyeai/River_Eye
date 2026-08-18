import json
import sys
from collections import Counter
from pathlib import Path

from PIL import Image

png = Path(sys.argv[1])
out = Path(sys.argv[2])
box = json.loads(sys.argv[3])
class_defs = json.loads(sys.argv[4])

im = Image.open(png).convert("RGBA")
veg = {k: v for k, v in Counter(im.getdata()).items() if k[3] > 0}
total = sum(veg.values())

lat_mid = (box["north"] + box["south"]) / 2
width_m = (box["east"] - box["west"]) * 111320 * __import__("math").cos(lat_mid * __import__("math").pi / 180)
height_m = (box["north"] - box["south"]) * 110540
cell_ha = (width_m / im.width) * (height_m / im.height) / 10000

classes = []
for defn in class_defs:
    pixels = sum(
        v
        for (r, g, b, a), v in veg.items()
        if f"{r:02X}{g:02X}{b:02X}" == defn["key"]
    )
    share = round(pixels / total * 100, 1) if total else 0
    classes.append(
        {
            **defn,
            "class": defn["id"],
            "pixels": pixels,
            "share_pct": share,
            "area_ha": round(pixels * cell_ha, 1),
        }
    )

doc = {
    "name": "Mula Mutha Vegetation Type AOI",
    "theme": "Biodiversity",
    "sensor": "Sentinel-2 (estimated ~10 m from overlay extent)",
    "captured": "May 2026",
    "note": "Non-vegetation class removed (fully transparent in the overlay).",
    "bounds": box,
    "raster": "/asset/mula-mutha-biodiversity-overlay.png",
    "imageCoordinates": [
        [box["west"], box["north"]],
        [box["east"], box["north"]],
        [box["east"], box["south"]],
        [box["west"], box["south"]],
    ],
    "layers": [
        {
            "id": "type",
            "title": "Vegetation type",
            "classes": classes,
            "total_pixels": total,
            "total_area_ha": round(sum(c["area_ha"] for c in classes), 1),
        }
    ],
}

out.write_text(json.dumps(doc, indent=2), encoding="utf-8")
for row in classes:
    print(f"{row['label']} {row['area_ha']} ha {row['share_pct']}%")
