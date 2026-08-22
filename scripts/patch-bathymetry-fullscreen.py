"""Apply RiverEye layout patches to mula-mutha-bathymetry.html.

- Docked two-row chrome (title + stat chips, then tabs + the active toolbar)
- 2D / 3D / analytics stage fills everything below the chrome
- Disable vendor pulsing red “deepest zone” rings

Called by sync-bathymetry-html.py after a vendor pull, and safe to run alone.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "public" / "asset" / "mula-mutha-bathymetry.html"

PATCH_START = "/* RIVEREYE_FULLSCREEN_START */"
PATCH_END = "/* RIVEREYE_FULLSCREEN_END */"
JS_MARK = "/* RIVEREYE_BATHY_RESIZE */"
DEEP_MARK = "/* RIVEREYE_NO_DEEP_PULSE */"
TAB_MARK = "/* RIVEREYE_TAB_RESIZE */"

FULLSCREEN_CSS = f"""
{PATCH_START}
/* RiverEye chrome.
   The vendor markup nests .stats/.tabs inside .wrap and .viewhead inside the
   panel, so the chrome is pinned with position:fixed (iframe viewport) rather
   than inheriting those offsets. --rv-chrome is the bar height the stage is
   inset by; --rv-backgap clears the host app's "Back to Map" button. */
:root{{--rv-chrome:104px;--rv-backgap:180px}}

html,body{{height:100%;width:100%;overflow:hidden;margin:0}}
body{{position:relative;min-height:100%;background:#06101f}}

/* ---------- docked chrome ---------- */
header{{
  position:fixed;top:0;left:0;right:0;height:var(--rv-chrome);
  padding:0;margin:0;z-index:1000;pointer-events:none;
  background:#0b1220;border-bottom:1px solid var(--line)
}}
header h1{{
  position:absolute;top:17px;left:var(--rv-backgap);max-width:min(38vw,420px);
  margin:0;pointer-events:auto;font-size:13px;font-weight:650;letter-spacing:.2px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis
}}
header .sub,.badges{{display:none !important}}

/* row 1 right — Min / Max / Mean chips */
.stats{{
  position:fixed;top:12px;right:14px;left:auto;bottom:auto;z-index:1100;
  display:flex;gap:8px;pointer-events:none
}}
.stats .card{{
  pointer-events:auto;display:flex;align-items:baseline;gap:7px;
  margin:0;padding:5px 11px;border-radius:8px;
  background:var(--panel2);border:1px solid var(--line);box-shadow:none
}}
.stats .card .k{{font-size:9px;letter-spacing:.07em;white-space:nowrap;margin:0}}
.stats .card .v{{font-size:14px;font-weight:650;margin:0;white-space:nowrap}}

/* row 2 left — view tabs (below the host Back button, which ends at y=56) */
.tabs{{
  position:fixed;top:58px;left:16px;right:auto;bottom:auto;z-index:1100;
  display:flex;gap:6px
}}
.tab{{padding:6px 12px;font-size:12px;border-radius:8px;background:var(--panel2)}}

/* row 2 right — the active panel's toolbar */
.viewhead{{
  position:fixed;top:58px;right:14px;left:auto;bottom:auto;z-index:1100;
  display:flex;justify-content:flex-end;align-items:center;
  margin:0;padding:0;border:none !important;background:none !important;
  box-shadow:none;max-width:calc(100vw - 540px)
}}
.viewhead h2{{display:none}}
.ctrls{{
  display:flex;align-items:center;gap:13px;font-size:11px;
  flex-wrap:nowrap;white-space:nowrap
}}
.ctrls label{{display:flex;align-items:center;gap:6px;white-space:nowrap}}
.ctrls input[type=range]{{width:92px}}
.btn{{padding:6px 11px;font-size:11px;border-radius:8px;white-space:nowrap}}

/* ---------- stage ---------- */
.wrap{{
  position:absolute;top:var(--rv-chrome);left:0;right:0;bottom:0;
  max-width:none;width:auto;height:auto;
  margin:0;padding:0;gap:0;display:block;box-sizing:border-box;z-index:auto
}}
.viewbox{{
  position:absolute !important;inset:0 !important;z-index:auto;
  border:none !important;border-radius:0 !important;
  background:transparent !important;overflow:visible
}}
.panel{{display:none !important}}
.panel.active{{display:block !important}}

#panel-2d > div[style*="relative"],
#panel-3d > div[style*="relative"],
#panel-an > div[style*="padding"]{{
  position:absolute !important;inset:0 !important;
  display:block !important;padding:0 !important;min-height:0;z-index:0
}}
#leaflet-map,#plot3d,#histplot{{
  position:absolute !important;inset:0 !important;
  width:100% !important;height:100% !important;min-height:0 !important;
  border-radius:0;z-index:0;background:#06101f
}}
#plot3d .js-plotly-plot,#plot3d .plot-container,#plot3d .svg-container,
#histplot .js-plotly-plot,#histplot .plot-container{{
  width:100% !important;height:100% !important
}}

/* ---------- in-stage overlays ---------- */
.legend{{
  right:14px !important;bottom:58px !important;z-index:900 !important;
  background:rgba(11,18,32,.92) !important;border-color:var(--line) !important
}}
#legend3d{{right:14px !important;bottom:58px !important}}
.hovertip,.section-box{{z-index:950 !important}}

.measure{{
  position:absolute;left:14px;right:14px;bottom:14px;z-index:900;
  margin:0;border:1px solid var(--line);border-radius:10px;
  background:rgba(11,18,32,.94)
}}
#draw-graph-panel{{
  position:absolute;left:14px;right:14px;bottom:62px;z-index:900;
  border:1px solid var(--line);border-radius:10px;
  background:rgba(11,18,32,.96);max-height:38vh;overflow:auto
}}
#ch-stats,.notes{{
  position:absolute;left:14px;right:14px;bottom:14px;z-index:900;
  background:rgba(11,18,32,.92);border-radius:10px;border:1px solid var(--line)
}}
footer{{display:none}}

@keyframes depthPulse{{0%,100%{{opacity:1;transform:none}}}}
.deep-ring{{animation:none !important;opacity:0 !important;display:none !important}}

/* the toolbar takes its own row once it can no longer sit beside the tabs */
@media (max-width:1400px){{
  :root{{--rv-chrome:150px}}
  .viewhead{{
    top:104px;left:16px;right:14px;max-width:none;justify-content:flex-start
  }}
  .ctrls{{flex-wrap:wrap;row-gap:8px;white-space:normal}}
}}
/* narrow: everything stacks below the host Back button */
@media (max-width:900px){{
  :root{{--rv-chrome:210px;--rv-backgap:16px}}
  header h1{{top:64px;left:16px;max-width:calc(100vw - 32px)}}
  .stats{{top:92px;left:16px;right:14px;flex-wrap:wrap}}
  .tabs{{top:134px;flex-wrap:wrap}}
  .viewhead{{top:176px}}
}}
{PATCH_END}
"""

RESIZE_JS = (
    f"\n{JS_MARK}\n"
    "window.__bathyMap=map;\n"
    "window.addEventListener('resize',function(){{\n"
    "  try{{map.invalidateSize()}}catch(e){{}}\n"
    "  try{{if(window.Plotly){{Plotly.Plots.resize('plot3d');Plotly.Plots.resize('histplot')}}}}catch(e){{}}\n"
    "}});\n"
    "setTimeout(function(){{try{{map.invalidateSize()}}catch(e){{}}}},250);\n"
    "setTimeout(function(){{try{{map.invalidateSize()}}catch(e){{}}}},800);\n"
)

TAB_HANDLER_RE = re.compile(
    r"document\.querySelectorAll\('\.tab'\)\.forEach\(t=>t\.onclick=\(\)=>\{\n"
    r" document\.querySelectorAll\('\.tab'\)\.forEach\(x=>x\.classList\.remove\('active'\)\);\n"
    r" document\.querySelectorAll\('\.panel'\)\.forEach\(x=>x\.classList\.remove\('active'\)\);\n"
    r" t\.classList\.add\('active'\);document\.getElementById\(t\.dataset\.t\)\.classList\.add\('active'\);\n"
    r" if\(t\.dataset\.t==='panel-3d'\)build3d\(\);\n"
    r" if\(t\.dataset\.t==='panel-an'\)buildHist\(\);\n"
    r" if\(t\.dataset\.t==='panel-2d'\)map\.invalidateSize\(\);\n"
    r"\}\);"
)

TAB_HANDLER_NEW = (
    "document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{\n"
    f" {TAB_MARK}\n"
    " document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));\n"
    " document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));\n"
    " t.classList.add('active');document.getElementById(t.dataset.t).classList.add('active');\n"
    " if(t.dataset.t==='panel-3d'){build3d();setTimeout(()=>{try{Plotly.Plots.resize('plot3d')}catch(e){}},120);}\n"
    " if(t.dataset.t==='panel-an'){buildHist();setTimeout(()=>{try{Plotly.Plots.resize('histplot')}catch(e){}},120);}\n"
    " if(t.dataset.t==='panel-2d'){map.invalidateSize();setTimeout(()=>map.invalidateSize(),120);}\n"
    "});"
)

# Also match already-patched tab handler so re-runs stay idempotent.
TAB_HANDLER_PATCHED_RE = re.compile(
    r"document\.querySelectorAll\('\.tab'\)\.forEach\(t=>t\.onclick=\(\)=>\{\n"
    r" /\* RIVEREYE_TAB_RESIZE \*/\n"
    r"[\s\S]*?"
    r"\}\);"
)

DEEP_BLOCK_RE = re.compile(
    r"// ---------- DEEPEST AREA AUTO-HIGHLIGHT ----------\n"
    r"(?:/\* RIVEREYE_NO_DEEP_PULSE \*/\n"
    r"// RiverEye: deepest-zone pulsing rings disabled \(static depth raster only\)\.\n"
    r"const deepThresh=1\.88;\n"
    r"const deepLayer=L\.layerGroup\(\);\n)"
    r"|"
    r"(?:const deepThresh=1\.88;\n"
    r"const deepLayer=L\.layerGroup\(\)\.addTo\(map\);\n"
    r"KML_PTS\.forEach\(pt=>\{\n"
    r" const d=depthAt\(pt\.lat,pt\.lon\);\n"
    r" if\(d!=null&&d>=deepThresh\)\{\n"
    r"  L\.circle\(\[pt\.lat,pt\.lon\],\{radius:80,color:'#ef4444',fillColor:'#ef4444',\n"
    r"   fillOpacity:0\.18,weight:2,dashArray:'5 4',className:'deep-ring',opacity:\.75\n"
    r"  \}\)\.addTo\(deepLayer\);\n"
    r" \}\n"
    r"\}\);\n)"
)

DEEP_BLOCK_REPLACEMENT = (
    "// ---------- DEEPEST AREA AUTO-HIGHLIGHT ----------\n"
    f"{DEEP_MARK}\n"
    "// RiverEye: deepest-zone pulsing rings disabled (static depth raster only).\n"
    "const deepThresh=1.88;\n"
    "const deepLayer=L.layerGroup();\n"
)


def apply_patch(html: str) -> str:
    html = re.sub(
        re.escape(PATCH_START) + r"[\s\S]*?" + re.escape(PATCH_END),
        "",
        html,
    )
    if "</style>" not in html:
        raise SystemExit("no </style> in bathymetry html")
    html = html.replace("</style>", FULLSCREEN_CSS + "\n</style>", 1)

    html = re.sub(
        re.escape(JS_MARK)
        + r"[\s\S]*?setTimeout\(function\(\)\{\{?try\{\{?map\.invalidateSize\(\)\}?catch\(e\)\{\{?\}\}?\},800\);\n?",
        "",
        html,
    )
    # Simpler cleanup of prior resize block variants
    html = re.sub(
        re.escape(JS_MARK) + r"[\s\S]*?setTimeout\(function\(\)\{try\{map\.invalidateSize\(\)\}catch\(e\)\{\}\},800\);\n?",
        "",
        html,
    )

    needle = (
        "const map=L.map('leaflet-map',{zoomControl:true})"
        ".fitBounds([[G.lat0,G.lon0],[latN,lonE]]);"
    )
    if needle not in html:
        raise SystemExit("map init line not found — vendor HTML may have changed")
    if JS_MARK not in html:
        html = html.replace(needle, needle + RESIZE_JS, 1)

    html2, n = DEEP_BLOCK_RE.subn(DEEP_BLOCK_REPLACEMENT, html, count=1)
    if n == 1:
        html = html2
    elif DEEP_MARK not in html:
        raise SystemExit(
            "deepest-area highlight block not found — vendor HTML may have changed"
        )

    html = html.replace("className:isDeepest?'deep-ring':''", "className:''")
    html = html.replace(
        "radius:isDeepest?13:9,color:isDeepest?'#ef4444':'#fff',",
        "radius:9,color:'#fff',",
    )
    html = html.replace("weight:isDeepest?3:2,", "weight:2,")

    if TAB_MARK in html:
        html3, n3 = TAB_HANDLER_PATCHED_RE.subn(TAB_HANDLER_NEW, html, count=1)
        if n3 == 1:
            html = html3
    else:
        html3, n3 = TAB_HANDLER_RE.subn(TAB_HANDLER_NEW, html, count=1)
        if n3 != 1:
            raise SystemExit("tab handler not found — vendor HTML may have changed")
        html = html3

    return html


def main():
    raw = HTML.read_text(encoding="utf-8")
    patched = apply_patch(raw)
    HTML.write_text(patched, encoding="utf-8")
    print("patched HUD overlay layout ->", HTML)


if __name__ == "__main__":
    main()
