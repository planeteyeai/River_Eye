"""Paint mula-mutha-depth-class.geojson to a smoothed PNG for the Digital Twin map."""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "public" / "asset" / "mula-mutha-depth-class.geojson"
SUMMARY = ROOT / "public" / "asset" / "mula-mutha-depth-summary.json"
PNG = ROOT / "public" / "asset" / "mula-mutha-depth-overlay.png"

COLORS = {
    0: (0, 0, 255, 255),
    1: (0, 255, 0, 255),
    2: (255, 255, 0, 255),
    3: (255, 128, 0, 255),
    4: (255, 0, 0, 255),
}

# Native cells are ~10 m. Paint at 4 m, then blur ~one cell so stairs dissolve.
MPP = 4.0
PAD_M = 25.0
BLUR_PX = 2.4


def rings_of(feature):
    geom = feature["geometry"]
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    return geom["coordinates"]


def bbox(features):
    west = south = float("inf")
    east = north = float("-inf")
    for feature in features:
        for poly in rings_of(feature):
            for ring in poly:
                for lon, lat in ring:
                    west = min(west, lon)
                    east = max(east, lon)
                    south = min(south, lat)
                    north = max(north, lat)
    return west, south, east, north


def main():
    geo = json.loads(GEO.read_text(encoding="utf-8"))
    features = geo["features"]
    west, south, east, north = bbox(features)
    lat_mid = (south + north) / 2
    m_per_lon = 111320 * __import__("math").cos(lat_mid * 3.141592653589793 / 180)
    m_per_lat = 110540
    pad_lon = PAD_M / m_per_lon
    pad_lat = PAD_M / m_per_lat
    west -= pad_lon
    east += pad_lon
    south -= pad_lat
    north += pad_lat

    width = max(8, int(round((east - west) * m_per_lon / MPP)))
    height = max(8, int(round((north - south) * m_per_lat / MPP)))
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    def to_px(lon, lat):
        x = (lon - west) / (east - west) * (width - 1)
        y = (north - lat) / (north - south) * (height - 1)
        return x, y

    for feature in features:
        color = COLORS.get(int(feature["properties"]["depth_class"]), (107, 135, 152, 255))
        for poly in rings_of(feature):
            outer = [to_px(lon, lat) for lon, lat in poly[0]]
            if len(outer) >= 3:
                draw.polygon(outer, fill=color)
            for hole in poly[1:]:
                pts = [to_px(lon, lat) for lon, lat in hole]
                if len(pts) >= 3:
                    draw.polygon(pts, fill=(0, 0, 0, 0))

    img = img.filter(ImageFilter.GaussianBlur(radius=BLUR_PX))
    img.save(PNG, "PNG", optimize=True)

    image_coordinates = [
        [west, north],
        [east, north],
        [east, south],
        [west, south],
    ]
    summary = json.loads(SUMMARY.read_text(encoding="utf-8"))
    summary["raster"] = "/asset/mula-mutha-depth-overlay.png"
    summary["raster_note"] = (
        "Class polygons painted at ~4 m and Gaussian-blurred so the Digital Twin "
        "overlay is not a stair-step grid. Class colours and cell counts are unchanged."
    )
    summary["bounds"] = {"west": west, "south": south, "east": east, "north": north}
    summary["imageCoordinates"] = image_coordinates
    summary["raster_width"] = width
    summary["raster_height"] = height
    SUMMARY.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print("wrote", PNG, PNG.stat().st_size, "px", width, height)


if __name__ == "__main__":
    main()
