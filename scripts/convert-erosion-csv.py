import csv
import json
import shutil
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
src = Path(sys.argv[1] if len(sys.argv) > 1 else r"c:\Users\Kunal.Desale\Downloads\18a4fe57b29043a4b371ba19a17dd597.csv")
dest_csv = root / "public/asset/mula-mutha-bank-erosion-2016-2026.csv"
dest_json = root / "public/asset/mula-mutha-bank-erosion-series.json"

shutil.copyfile(src, dest_csv)

def num(row, key):
    return float(row[key])

def round1(value):
    return round(value, 1)

with src.open(encoding="utf-8-sig", newline="") as handle:
    raw = list(csv.DictReader(handle))

periods = []
for row in raw:
    periods.append(
        {
            "period": row["Period"],
            "from_year": int(row["From_Year"]),
            "to_year": int(row["To_Year"]),
            "window": row["Analysis_Period"],
            "erosion_ha": round1(num(row, "Erosion_ha")),
            "accretion_ha": round1(num(row, "Accretion_ha")),
            "net_ha": round1(num(row, "Net_Change_ha")),
            "erosion_pct": round1(num(row, "Erosion_percent")),
            "accretion_pct": round1(num(row, "Accretion_percent")),
            "image_count": int(row["Image_Count"]),
        }
    )

erosion_ha = round1(sum(num(row, "Erosion_ha") for row in raw))
accretion_ha = round1(sum(num(row, "Accretion_ha") for row in raw))
net_ha = round1(sum(num(row, "Net_Change_ha") for row in raw))

doc = {
    "name": "Bank erosion vs accretion, 2016–2026",
    "theme": "Geology",
    "file": "mula-mutha-bank-erosion-2016-2026.csv",
    "source_csv": "18a4fe57b29043a4b371ba19a17dd597.csv / Bank_Erosion_2016_2026.csv",
    "satellite": raw[0]["Satellite"],
    "resolution_m": int(float(raw[0]["Resolution_m"])),
    "mndwi_threshold": float(raw[0]["MNDWI_Threshold"]),
    "note": "Year-to-year MNDWI water-edge change. Negative net is net erosion. 2025–2026 is Jan–Aug 2026, not a full year. .geo column is an empty MultiPoint — no map geometry.",
    "totals": {
        "periods": len(periods),
        "erosion_ha": erosion_ha,
        "accretion_ha": accretion_ha,
        "net_ha": net_ha,
        "max_bar_ha": round1(max(max(p["erosion_ha"], p["accretion_ha"]) for p in periods)),
    },
    "periods": periods,
}

dest_json.write_text(json.dumps(doc, indent=2), encoding="utf-8")
print("wrote", dest_csv)
print("wrote", dest_json)
print("erosion", erosion_ha, "accretion", accretion_ha, "net", net_ha)
