# Convert Mula-Mutha LULC KMZs (2021–2025) + 2026 polygon KML into app assets.
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

src_dir = Path(
    sys.argv[1]
    if len(sys.argv) > 1
    else r"c:\Users\Kunal.Desale\Downloads\9c8abfb75e894e2c8ca7deb87177a63a\LULC UPTO2025"
)
src_2026 = Path(
    sys.argv[2]
    if len(sys.argv) > 2
    else r"c:\Users\Kunal.Desale\Downloads\e2fb7e9804ee41f9a30672734067ffc1.kml"
)

CLASS_DEFS_2021_2025 = [
    {"id": 0, "key": "006400", "label": "Forest", "color": "#006400"},
    {"id": 1, "key": "E6A23C", "label": "Crop land", "color": "#e6a23c"},
    {"id": 2, "key": "A9A9A9", "label": "Barren land", "color": "#a9a9a9"},
    {"id": 3, "key": "2196F3", "label": "Water bodies", "color": "#2196f3"},
    {"id": 4, "key": "C62828", "label": "Settlements", "color": "#c62828"},
]

# 2026 polygon KML class ids → legend (lulc2026.kml). Display colours follow
# the named legend (blue/red/green/yellow/brown), not the raw KML style hexes.
CLASS_DEFS_2026 = [
    {"id": 0, "label": "Water bodies", "color": "#2196f3"},
    {"id": 1, "label": "Settlements", "color": "#c62828"},
    {"id": 2, "label": "Forest/dense Vegetation", "color": "#006400"},
    {"id": 3, "label": "Cropland", "color": "#f4c430"},
    {"id": 4, "label": "Barren land", "color": "#8d6e63"},
]

YEARS = [
    (2021, "MulaMutha_LULC_2021.kmz"),
    (2022, "MulaMutha_LULC_2022.kmz"),
    (2023, "MulaMutha_LULC_2023.kmz"),
    (2024, "MulaMutha_LULC_2024.kmz"),
    (2025, "MulaMutha_LULC_2025.kmz"),
]

tmp = root / "tmp-lulc-convert"
if tmp.exists():
    shutil.rmtree(tmp)
tmp.mkdir()


def box_from_kml(kml: str):
    return {
        "north": float(re.search(r"<north>([^<]+)</north>", kml).group(1)),
        "south": float(re.search(r"<south>([^<]+)</south>", kml).group(1)),
        "east": float(re.search(r"<east>([^<]+)</east>", kml).group(1)),
        "west": float(re.search(r"<west>([^<]+)</west>", kml).group(1)),
    }


def coords_from_box(box):
    return [
        [box["west"], box["north"]],
        [box["east"], box["north"]],
        [box["east"], box["south"]],
        [box["west"], box["south"]],
    ]


def sample_png(png_path: Path, box: dict, class_defs: list):
    im = Image.open(png_path).convert("RGBA")
    opaque = Counter((r, g, b) for r, g, b, a in im.getdata() if a > 0)
    total = sum(opaque.values())
    lat_mid = (box["north"] + box["south"]) / 2
    width_m = (box["east"] - box["west"]) * 111320 * math.cos(lat_mid * math.pi / 180)
    height_m = (box["north"] - box["south"]) * 110540
    cell_ha = (width_m / im.width) * (height_m / im.height) / 10000
    classes = []
    for defn in class_defs:
        key = defn["key"].upper()
        pixels = sum(v for (r, g, b), v in opaque.items() if f"{r:02X}{g:02X}{b:02X}" == key)
        share = round(pixels / total * 100, 1) if total else 0
        classes.append(
            {
                "id": defn["id"],
                "class": defn["id"],
                "label": defn["label"],
                "color": defn["color"],
                "pixels": pixels,
                "share_pct": share,
                "area_ha": round(pixels * cell_ha, 1),
            }
        )
    return {
        "classes": classes,
        "total_pixels": total,
        "total_area_ha": round(sum(c["area_ha"] for c in classes), 1),
        "width": im.width,
        "height": im.height,
    }


def unpack_kmz(kmz_path: Path, dest: Path):
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(kmz_path) as zf:
        zf.extractall(dest)


def kml_abgr_to_hex(abgr: str) -> str:
    abgr = abgr.lower()
    b, g, r = abgr[6:8], abgr[4:6], abgr[2:4]
    return f"#{r}{g}{b}"


def parse_coords(coord_text: str):
    ring = []
    for token in coord_text.strip().split():
        parts = token.split(",")
        if len(parts) < 2:
            continue
        lng, lat = float(parts[0]), float(parts[1])
        ring.append([lng, lat])
    if ring and ring[0] != ring[-1]:
        ring.append(ring[0])
    return ring


periods = []
for year, kmz_name in YEARS:
    kmz_path = src_dir / kmz_name
    if not kmz_path.exists():
        raise SystemExit(f"Missing {kmz_path}")
    dest = tmp / str(year)
    unpack_kmz(kmz_path, dest)
    kml_path = next(dest.rglob("*.kml"))
    png_path = next(p for p in dest.rglob("*.png"))
    kml = kml_path.read_text(encoding="utf-8", errors="replace")
    box = box_from_kml(kml)
    out_png = asset / f"mula-mutha-lulc-{year}.png"
    out_kml = asset / f"mula-mutha-lulc-{year}.kml"
    shutil.copyfile(png_path, out_png)
    shutil.copyfile(kml_path, out_kml)
    sampled = sample_png(out_png, box, CLASS_DEFS_2021_2025)
    print(
        year,
        ", ".join(f"{c['label']} {c['share_pct']}%" for c in sampled["classes"]),
        f"-> {out_png.name}",
    )
    periods.append(
        {
            "id": year - 2021,
            "year": year,
            "label": str(year),
            "kind": "raster",
            "source_kmz": kmz_name,
            "bounds": box,
            "imageCoordinates": coords_from_box(box),
            "raster": f"/asset/mula-mutha-lulc-{year}.png",
            "kml": f"/asset/mula-mutha-lulc-{year}.kml",
            "bytes": out_png.stat().st_size,
            "classes": sampled["classes"],
            "total_pixels": sampled["total_pixels"],
            "total_area_ha": sampled["total_area_ha"],
            "width": sampled["width"],
            "height": sampled["height"],
        }
    )

# ---- 2026 polygon KML → GeoJSON ----
text = src_2026.read_text(encoding="utf-8", errors="replace")
styles = {}
for m in re.finditer(r'<Style id="([^"]+)">(.*?)</Style>', text, re.S):
    sid, body = m.group(1), m.group(2)
    cm = re.search(r"<PolyStyle[^>]*>\s*<color>([0-9A-Fa-f]{8})</color>", body, re.S)
    if cm:
        styles[sid] = kml_abgr_to_hex(cm.group(1))

features = []
class_counts = Counter()
min_lng = min_lat = float("inf")
max_lng = max_lat = float("-inf")
defs_by_id = {row["id"]: row for row in CLASS_DEFS_2026}

for m in re.finditer(r"<Placemark[^>]*>(.*?)</Placemark>", text, re.S):
    body = m.group(1)
    name = re.search(r"<name>([^<]+)</name>", body)
    su = re.search(r"<styleUrl>#([^<]+)</styleUrl>", body)
    coords = re.search(r"<coordinates>([^<]+)</coordinates>", body)
    if not name or not su or not coords:
        continue
    class_match = re.search(r"Class\s*(\d+)", name.group(1))
    if not class_match:
        continue
    class_id = int(class_match.group(1))
    defn = defs_by_id.get(class_id)
    color = defn["color"] if defn else styles.get(su.group(1), "#888888")
    label = defn["label"] if defn else f"Class {class_id}"
    ring = parse_coords(coords.group(1))
    if len(ring) < 4:
        continue
    for lng, lat in ring:
        min_lng = min(min_lng, lng)
        max_lng = max(max_lng, lng)
        min_lat = min(min_lat, lat)
        max_lat = max(max_lat, lat)
    class_counts[class_id] += 1
    features.append(
        {
            "type": "Feature",
            "properties": {
                "class": class_id,
                "label": label,
                "color": color,
                "name": name.group(1),
            },
            "geometry": {"type": "Polygon", "coordinates": [ring]},
        }
    )

total_poly = sum(class_counts.values()) or 1
classes_2026 = []
for defn in CLASS_DEFS_2026:
    count = class_counts[defn["id"]]
    classes_2026.append(
        {
            "id": defn["id"],
            "class": defn["id"],
            "label": defn["label"],
            "color": defn["color"],
            "polygons": count,
            "share_pct": round(count / total_poly * 100, 1),
        }
    )

geojson = {
    "type": "FeatureCollection",
    "name": "Mula-Mutha LULC 2026",
    "features": features,
}
out_geo = asset / "mula-mutha-lulc-2026.geojson"
out_geo.write_text(json.dumps(geojson), encoding="utf-8")

box_2026 = {
    "north": max_lat,
    "south": min_lat,
    "east": max_lng,
    "west": min_lng,
}
print("2026", ", ".join(f"{c['label']} {c['share_pct']}%" for c in classes_2026), f"features={len(features)}")

periods.append(
    {
        "id": 5,
        "year": 2026,
        "label": "2026",
        "kind": "polygons",
        "source_kml": "e2fb7e9804ee41f9a30672734067ffc1.kml / lulc2026.kml",
        "bounds": box_2026,
        "geojson": "/asset/mula-mutha-lulc-2026.geojson",
        "feature_count": len(features),
        "classes": classes_2026,
        "note": (
            "Polygon classes from smoothed classified raster (lulc2026.kml). "
            "Legend: 0 Water bodies, 1 Settlements, 2 Forest/dense Vegetation, "
            "3 Cropland, 4 Barren land. Display colours remapped to named legend "
            "(blue/red/green/yellow/brown); class ids differ from 2021–2025."
        ),
    }
)

doc = {
    "name": "Mula-Mutha land use / land cover",
    "theme": "Soil & land use",
    "captured": "2021–2026",
    "kind": "Estimated",
    "sensor": "Unconfirmed in KMZ/KML (classed LULC product)",
    "note": (
        "2021–2025 are GroundOverlay rasters from MulaMutha_LULC_YYYY.kmz with legend "
        "Forest / Crop land / Barren land / Water bodies / Settlements. "
        "2026 is a polygon KML (Classified Raster smoothed) with a different class-id "
        "order: Water / Settlements / Forest/dense Vegetation / Cropland / Barren land."
    ),
    "default_period": 4,
    "classes": [
        {"class": c["id"], "label": c["label"], "color": c["color"]} for c in CLASS_DEFS_2021_2025
    ],
    "classes_2026": [
        {"class": c["id"], "label": c["label"], "color": c["color"]} for c in CLASS_DEFS_2026
    ],
    "periods": periods,
    "source_folder": "9c8abfb75e894e2c8ca7deb87177a63a / LULC UPTO2025",
    "source_2026": "e2fb7e9804ee41f9a30672734067ffc1.kml",
}

out_json = asset / "mula-mutha-lulc.json"
out_json.write_text(json.dumps(doc, indent=2), encoding="utf-8")
shutil.rmtree(tmp)
print("wrote", out_json)
print("wrote", out_geo, "bytes", out_geo.stat().st_size)
