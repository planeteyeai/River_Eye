"""Count opaque pixels in a silt classification PNG against known class colours."""
import json
import math
import sys
from collections import Counter
from pathlib import Path

from PIL import Image

png = Path(sys.argv[1])
box = json.loads(sys.argv[2])
class_defs = json.loads(sys.argv[3])

im = Image.open(png).convert("RGBA")
opaque = {k: v for k, v in Counter(im.getdata()).items() if k[3] > 32}
total = sum(opaque.values())

lat_mid = (box["north"] + box["south"]) / 2
width_m = (box["east"] - box["west"]) * 111320 * math.cos(lat_mid * math.pi / 180)
height_m = (box["north"] - box["south"]) * 110540
cell_ha = (width_m / im.width) * (height_m / im.height) / 10000


def hex_of(rgb):
    return f"{rgb[0]:02X}{rgb[1]:02X}{rgb[2]:02X}"


def dist(a, b):
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2


targets = []
for defn in class_defs:
    r = int(defn["key"][0:2], 16)
    g = int(defn["key"][2:4], 16)
    b = int(defn["key"][4:6], 16)
    targets.append((defn, (r, g, b)))

classes = []
for defn, target in targets:
    pixels = 0
    for (r, g, b, a), count in opaque.items():
        if dist((r, g, b), target) <= 18 ** 2:
            pixels += count
    share = round(pixels / total * 100, 1) if total else 0
    classes.append(
        {
            "class": defn["id"],
            "label": defn["label"],
            "color": defn["color"],
            "pixels": pixels,
            "share_pct": share,
            "area_ha": round(pixels * cell_ha, 1),
        }
    )

print(json.dumps({
    "width": im.width,
    "height": im.height,
    "opaque_pixels": total,
    "top_hex": [
        {"hex": hex_of(k), "n": v, "a": k[3]}
        for k, v in sorted(opaque.items(), key=lambda x: -x[1])[:12]
    ],
    "classes": classes,
    "total_area_ha": round(sum(c["area_ha"] for c in classes), 1),
}))
