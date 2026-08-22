"""Convert MulaMutha_NDSI_Salinity_River.kml → GeoJSON + summary JSON."""
from __future__ import annotations

import json
import re
import shutil
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / "public" / "asset"
SRC = ASSET / "mula-mutha-ndsi-salinity.kml"
OUT_GEO = ASSET / "mula-mutha-ndsi-salinity.geojson"
OUT_JSON = ASSET / "mula-mutha-ndsi-salinity.json"
OUT_KML = ASSET / "mula-mutha-ndsi-salinity.kml"

# KML PolyStyle AABBGGRR → Odeh & Onus (2008) NDSI legend colours
CLASS_BY_KML_COLOR = {
    "E6FF0000": {
        "class": 1,
        "label": "Very Low",
        "range": "-1.00 to -0.60",
        "color": "#0000FF",
    },
    "E6FFBF00": {
        "class": 2,
        "label": "Low",
        "range": "-0.60 to -0.20",
        "color": "#00BFFF",
    },
    "E600FF00": {
        "class": 3,
        "label": "Moderate",
        "range": "-0.20 to 0.20",
        "color": "#00FF00",
    },
    "E600FFFF": {
        "class": 4,
        "label": "High",
        "range": "0.20 to 0.60",
        "color": "#FFFF00",
    },
    "E60000FF": {
        "class": 5,
        "label": "Very High",
        "range": "0.60 to 1.00",
        "color": "#FF0000",
    },
}


def parse_coords(raw: str) -> list[list[float]]:
    ring = []
    for token in raw.strip().split():
        parts = token.split(",")
        if len(parts) < 2:
            continue
        ring.append([float(parts[0]), float(parts[1])])
    if ring and ring[0] != ring[-1]:
        ring.append(ring[0][:])
    return ring


def main():
    text = SRC.read_text(encoding="utf-8", errors="replace")
    ASSET.mkdir(parents=True, exist_ok=True)
    if SRC.resolve() != OUT_KML.resolve():
        shutil.copyfile(SRC, OUT_KML)

    style_colors: dict[str, str] = {}
    for m in re.finditer(r'<Style[^>]*id="(\d+)"[^>]*>(.*?)</Style>', text, re.S):
        sid, body = m.group(1), m.group(2)
        cm = re.search(r"<PolyStyle[^>]*>.*?<color>([0-9A-Fa-f]{8})</color>", body, re.S)
        if cm:
            style_colors[sid] = cm.group(1).upper()

    features = []
    class_counts: Counter[str] = Counter()
    for m in re.finditer(r"<Placemark[^>]*>(.*?)</Placemark>", text, re.S):
        body = m.group(1)
        name_m = re.search(r"<name>([^<]*)</name>", body)
        style_m = re.search(r"<styleUrl>#(\d+)</styleUrl>", body)
        coord_m = re.search(r"<coordinates>([^<]+)</coordinates>", body)
        if not coord_m:
            continue
        ring = parse_coords(coord_m.group(1))
        if len(ring) < 4:
            continue

        kml_color = style_colors.get(style_m.group(1) if style_m else "", "")
        meta = CLASS_BY_KML_COLOR.get(kml_color)
        if not meta:
            desc_m = re.search(r"NDSI Salinity class: ([^<]+)", body)
            label_hint = desc_m.group(1).strip() if desc_m else ""
            for val in CLASS_BY_KML_COLOR.values():
                if val["label"] in label_hint:
                    meta = val
                    break
        if not meta:
            continue

        class_counts[meta["label"]] += 1
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "name": (name_m.group(1).strip() if name_m else "") or f"NDSI {len(features) + 1}",
                    "class": meta["class"],
                    "label": meta["label"],
                    "range": meta["range"],
                    "color": meta["color"],
                },
                "geometry": {"type": "Polygon", "coordinates": [ring]},
            }
        )

    lons = [c[0] for f in features for ring in f["geometry"]["coordinates"] for c in ring]
    lats = [c[1] for f in features for ring in f["geometry"]["coordinates"] for c in ring]
    doc = {
        "type": "FeatureCollection",
        "name": "Mula-Mutha River - NDSI Salinity (Odeh & Onus 2008)",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": features,
    }
    OUT_GEO.write_text(json.dumps(doc), encoding="utf-8")

    summary = {
        "name": "NDSI Salinity — Odeh & Onus (2008)",
        "kind": "Estimated",
        "method": "NDSI (Normalised Difference Salinity Index)",
        "source_kml": "111efbd6d8d0406d9f50a2506cd30388.kml / MulaMutha_NDSI_Salinity_River.kml",
        "geojson": "/asset/mula-mutha-ndsi-salinity.geojson",
        "kml": "/asset/mula-mutha-ndsi-salinity.kml",
        "count": len(features),
        "class_counts": dict(class_counts),
        "classes": [
            {"class": v["class"], "label": v["label"], "range": v["range"], "color": v["color"]}
            for v in CLASS_BY_KML_COLOR.values()
        ],
        "bounds": {
            "west": min(lons),
            "east": max(lons),
            "south": min(lats),
            "north": max(lats),
        },
        "note": (
            "Classified river-surface NDSI salinity polygons along the Mula-Mutha "
            "reach. Five classes per Odeh & Onus (2008) legend. Source KML has no "
            "capture date or sensor metadata."
        ),
    }
    OUT_JSON.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print("wrote", OUT_GEO, "features", len(features))
    print("class_counts", dict(class_counts))
    print("bbox", summary["bounds"])


if __name__ == "__main__":
    main()
