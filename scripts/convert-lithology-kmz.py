# Convert Mula_Mutha_Spectral_Lithology KMZ -> app assets.
import json
import math
import re
import shutil
import sys
import zipfile
from collections import Counter
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parents[1]
asset = root / "public" / "asset"
asset.mkdir(parents=True, exist_ok=True)

src_kmz = Path(
    sys.argv[1]
    if len(sys.argv) > 1
    else r"c:\Users\Kunal.Desale\Downloads\b7acfdf14dfa4a5a9c0ec4c050e2d000.kmz"
)

# Legend order from files/legend.png (class 1 is unused in the product).
CLASS_DEFS = [
    {"id": 0, "key": "00FFFF", "label": "Water", "color": "#00ffff"},
    {"id": 2, "key": "8B0000", "label": "Basaltic / mafic", "color": "#8b0000"},
    {"id": 3, "key": "FF8C00", "label": "Weathered rock", "color": "#ff8c00"},
    {"id": 4, "key": "FFD700", "label": "Alluvial / sedimentary", "color": "#ffd700"},
    {"id": 5, "key": "FF0000", "label": "Ferruginous / iron-rich", "color": "#ff0000"},
    {"id": 6, "key": "9370DB", "label": "Clay-rich", "color": "#9370db"},
    {"id": 7, "key": "708090", "label": "Silica-rich", "color": "#708090"},
    {"id": 8, "key": "A0522D", "label": "Mixed rock-soil", "color": "#a0522d"},
]
# Cartographic remaps of Mixed rock-soil along the main channel (see KMZ note).
RIVER_KEYS = ("0066CC", "00408C")

tmp = root / "tmp-lithology-convert"
if tmp.exists():
    shutil.rmtree(tmp)
tmp.mkdir()

with zipfile.ZipFile(src_kmz) as zf:
    zf.extractall(tmp)

kml_path = next(tmp.rglob("*.kml"))
png_path = next(p for p in tmp.rglob("*.png") if p.name.lower() == "overlay.png")
legend_path = next((p for p in tmp.rglob("*.png") if p.name.lower() == "legend.png"), None)

kml = kml_path.read_text(encoding="utf-8", errors="replace")
box = {
    "north": float(re.search(r"<north>([^<]+)</north>", kml).group(1)),
    "south": float(re.search(r"<south>([^<]+)</south>", kml).group(1)),
    "east": float(re.search(r"<east>([^<]+)</east>", kml).group(1)),
    "west": float(re.search(r"<west>([^<]+)</west>", kml).group(1)),
}

out_png = asset / "mula-mutha-spectral-lithology.png"
out_legend = asset / "mula-mutha-spectral-lithology-legend.png"
out_kml = asset / "mula-mutha-spectral-lithology.kml"
out_json = asset / "mula-mutha-spectral-lithology.json"

shutil.copyfile(png_path, out_png)
shutil.copyfile(kml_path, out_kml)
if legend_path:
    shutil.copyfile(legend_path, out_legend)

im = Image.open(out_png).convert("RGBA")
opaque = Counter((r, g, b) for r, g, b, a in im.getdata() if a > 0)
total = sum(opaque.values())

targets = []
for defn in CLASS_DEFS:
    key = defn["key"]
    targets.append((defn["id"], int(key[0:2], 16), int(key[2:4], 16), int(key[4:6], 16)))
for key in RIVER_KEYS:
    targets.append(("river", int(key[0:2], 16), int(key[2:4], 16), int(key[4:6], 16)))

# Nearest-color bucket within RGB distance 48 (covers anti-aliased edges).
buckets = Counter()
max_d2 = 48 * 48
for (r, g, b), count in opaque.items():
    best = None
    best_d = max_d2 + 1
    for tid, tr, tg, tb in targets:
        d = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2
        if d < best_d:
            best_d = d
            best = tid
    if best is not None and best_d <= max_d2:
        buckets[best] += count

lat_mid = (box["north"] + box["south"]) / 2
width_m = (box["east"] - box["west"]) * 111320 * math.cos(lat_mid * math.pi / 180)
height_m = (box["north"] - box["south"]) * 110540
cell_ha = (width_m / im.width) * (height_m / im.height) / 10000

classified = sum(buckets.values()) or 1
classes = []
for defn in CLASS_DEFS:
    pixels = buckets[defn["id"]]
    # Mixed rock-soil channel remapped to blue still counts as class 8 for area share.
    if defn["id"] == 8:
        pixels += buckets["river"]
    share = round(pixels / classified * 100, 1)
    classes.append(
        {
            "id": defn["id"],
            "class": defn["id"],
            "key": defn["key"],
            "label": defn["label"],
            "color": defn["color"],
            "pixels": pixels,
            "share_pct": share,
            "area_ha": round(pixels * cell_ha, 1),
        }
    )

river_pixels = buckets["river"]
doc = {
    "name": "Mula Mutha Spectral Lithology / Surface Material",
    "theme": "Geology",
    "period": "Provisional",
    "sensor": "Classed GeoTIFF (EPSG:32643, 20 m) → display PNG in EPSG:4326",
    "kind": "Estimated",
    "note": (
        "Provisional spectral lithology from Mula_Mutha_Spectral_Lithology_Map.tif. "
        "Eight class values; class 1 unused. The winding channel is spectrally "
        "Mixed rock-soil but drawn solid blue for cartographic clarity. "
        "Mixed rock-soil share includes those remapped channel pixels."
    ),
    "bounds": box,
    "raster": "/asset/mula-mutha-spectral-lithology.png",
    "legend": "/asset/mula-mutha-spectral-lithology-legend.png" if legend_path else None,
    "kml": "/asset/mula-mutha-spectral-lithology.kml",
    "imageCoordinates": [
        [box["west"], box["north"]],
        [box["east"], box["north"]],
        [box["east"], box["south"]],
        [box["west"], box["south"]],
    ],
    "classes": classes,
    "river_channel": {
        "label": "River channel (cartographic)",
        "color": "#0066cc",
        "note": "Shown blue; spectrally classed as Mixed rock-soil",
        "pixels": river_pixels,
        "share_pct": round(river_pixels / classified * 100, 1),
        "area_ha": round(river_pixels * cell_ha, 1),
    },
    "total_pixels": total,
    "classified_pixels": classified,
    "total_area_ha": round(sum(c["area_ha"] for c in classes), 1),
    "width": im.width,
    "height": im.height,
    "source_kmz": src_kmz.name,
    "source_name": "Mula_Mutha_Spectral_Lithology",
}

out_json.write_text(json.dumps(doc, indent=2), encoding="utf-8")
print("wrote", out_json)
print("wrote", out_png)
for row in classes:
    print(f"{row['id']} {row['label']} {row['share_pct']}% {row['area_ha']} ha")
print(
    "river channel",
    doc["river_channel"]["share_pct"],
    "%",
    doc["river_channel"]["area_ha"],
    "ha",
)
