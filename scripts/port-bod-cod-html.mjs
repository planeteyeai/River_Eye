import fs from 'fs'

const LIGHT_CLASS = {
  A: '#1668b3',
  B: '#1c8a55',
  C: '#b8860b',
  D: '#d2701a',
  E: '#c2372a',
  NA: '#6b8798',
}

const LIGHT_ROOT = `:root{
  --water:#e9f1f7; --panel:#ffffff; --panel2:#f4f9fc; --line:#d5e3ee;
  --line-strong:#b8cfe0; --ink:#0d2436; --ink2:#3a5c73; --muted:#6b8798;
  --faint:#93aebe; --marigold:#b3761a; --marigold-soft:#fbf0dc; --alert:#c2372a;
  --ok:#1c8a55; --blue:#1668b3; --teal:#0e8f9c;
  --shadow:0 1px 2px rgba(15,37,64,.06),0 1px 3px rgba(15,37,64,.07);
  --disp:'Lora',Georgia,"Times New Roman",serif;
  --body:'Inter',"Segoe UI",system-ui,-apple-system,sans-serif;
  --mono:'JetBrains Mono',ui-monospace,Consolas,monospace;
}`

const FONT_LINK =
  '<link href="https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">'

const src = process.env.TEMP + '/mula-mutha-bod-cod-new.html'
let html = fs.readFileSync(src, 'utf8')

html = html.replace(
  /<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Fraunces[^"]+" rel="stylesheet">/,
  FONT_LINK,
)

html = html.replace(/:root\{[\s\S]*?\}/, LIGHT_ROOT)
html = html.replace('a{color:var(--marigold)}', 'a{color:var(--blue)}')
html = html.replace(
  '.banner{margin:14px 0 20px;padding:10px 14px;border:1px solid #6b5316;\n        background:linear-gradient(90deg,#2a2210,#1c1a10);border-radius:6px;\n        color:#f0d089;font-size:13px;display:flex;gap:10px;align-items:baseline}',
  '.banner{margin:14px 0 20px;padding:10px 14px;border:1px solid #e3c98f;\n        background:linear-gradient(90deg,#fdf6e6,#fbf1d6);border-radius:6px;\n        color:#7a5512;font-size:13px;display:flex;gap:10px;align-items:baseline}',
)
html = html.replace(
  '.banner b{font-family:var(--mono);font-size:11px;letter-spacing:1px;\n          border:1px solid #f0d089;border-radius:3px;padding:1px 6px;white-space:nowrap}',
  '.banner b{font-family:var(--mono);font-size:11px;letter-spacing:1px;\n          border:1px solid #b3761a;border-radius:3px;padding:1px 6px;white-space:nowrap}',
)
html = html.replace(
  '.ribbon-card{background:var(--panel);border:1px solid var(--line);\n             border-radius:10px;padding:18px 18px 8px;margin-bottom:20px}',
  '.ribbon-card{background:var(--panel);border:1px solid var(--line);\n             border-radius:10px;padding:18px 18px 8px;margin-bottom:20px;box-shadow:var(--shadow)}',
)
html = html.replace(
  '.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px}',
  '.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;box-shadow:var(--shadow)}',
)
html = html.replace('.chip.cls{color:#08131a;font-weight:600;border:none}', '.chip.cls{color:#ffffff;font-weight:600;border:none}')
html = html.replace('.chip.kml{border-color:#2dc0fb;color:#2dc0fb}', '.chip.kml{border-color:var(--blue);color:var(--blue)}')
html = html.replace('.alert-item.advisory{border-color:#5b7d89}', '.alert-item.advisory{border-color:var(--ink2)}')

const jsInject = `  const CLASS_COLORS = {A:'#1668b3',B:'#1c8a55',C:'#b8860b',D:'#d2701a',E:'#c2372a',NA:'#6b8798'};
  const INK='#0d2436', INK2='#3a5c73', MUTED='#6b8798', FAINT='#93aebe',
        AXIS_LINE='#b8cfe0', SAND='#b3761a', ALERT='#c2372a', KML_BLUE='#1668b3', COD_LINE='#1668b3';
  D.class_colors = Object.assign({}, D.class_colors, CLASS_COLORS);
`
html = html.replace(
  `  const COLORS = D.class_colors, EDGES = D.bod_edges;`,
  jsInject + `  const COLORS = D.class_colors, EDGES = D.bod_edges;`,
)

const swaps = [
  ['stroke="rgba(11,23,29,.55)"', 'stroke="rgba(255,255,255,.6)"'],
  ["seg.setAttribute('stroke','#2dc0fb')", "seg.setAttribute('stroke',KML_BLUE)"],
  ["seg.setAttribute('stroke','rgba(234,241,239,.7)')", "seg.setAttribute('stroke','rgba(13,36,54,.55)')"],
  ["fill:'#5f777d'", "fill:MUTED"],
  ["fill:'#9fb4b8'", "fill:INK2"],
  ["'font-family':'IBM Plex Mono'", "'font-family':'JetBrains Mono'"],
  ["'font-family':'IBM Plex Sans'", "'font-family':'Inter'"],
  ['background:#2E7DD1;opacity:.75;outline:1px dashed #cfd', 'background:${CLASS_COLORS.A};opacity:.75;outline:1px dashed #0d2436'],
  ['outline:2px solid #2dc0fb', 'outline:2px solid ${KML_BLUE}'],
  ["fill=\"#E8A13D\" fill-opacity=\".13\"", 'fill="${SAND}" fill-opacity=".18"'],
  ["seg(p50,0,todayIdx,false,'#EAF1EF')+seg(p50,todayIdx,n-1,true,'#EAF1EF')", "seg(p50,0,todayIdx,false,INK)+seg(p50,todayIdx,n-1,true,INK)"],
  ["seg(cod50,0,todayIdx,true,'#2dc0fb',1.4)+seg(cod50,todayIdx,n-1,true,'#2dc0fb',1.4)", "seg(cod50,0,todayIdx,true,COD_LINE,1.4)+seg(cod50,todayIdx,n-1,true,COD_LINE,1.4)"],
  ['stroke="#E8A13D" stroke-width="1" stroke-opacity=".55"', 'stroke="${SAND}" stroke-width="1" stroke-opacity=".55"'],
  ['fill="#E8A13D" font-size="9"', 'fill="${SAND}" font-size="9"'],
  ['font-family="IBM Plex Mono" fill-opacity=".7"', 'font-family="JetBrains Mono" fill-opacity=".7"'],
  ['stroke="#EAF1EF" stroke-width="1.5"', 'stroke="${INK}" stroke-width="1.5" stroke-opacity=".5"'],
  ['r="4" fill="#E8A13D" stroke="#0B171D"', 'r="4" fill="${SAND}" stroke="#ffffff"'],
  ['r="3.5" fill="#2dc0fb" stroke="#0B171D"', 'r="3.5" fill="${COD_LINE}" stroke="#ffffff"'],
  ['stroke="#203945"/>', 'stroke="${AXIS_LINE}"/>'],
  ['fill="#7F979D"', 'fill="${MUTED}"'],
  ['font-family="IBM Plex Mono"', 'font-family="JetBrains Mono"'],
  ['stroke="#203945"/>', 'stroke="${AXIS_LINE}"/>'],
  ["fill=\"${up?'#E8A13D':'#D14B3A'}\"", "fill=\"${up?SAND:ALERT}\""],
  ["stroke=\"${active?'#EAF1EF':'none'}\"", "stroke=\"${active?INK:'none'}\""],
  ["fill=\"${up?'#E8A13D':'#D14B3A'}\" font-size=\"8\" font-family=\"JetBrains Mono\"", "fill=\"${up?SAND:ALERT}\" font-size=\"8\" font-family=\"JetBrains Mono\""],
  ["fill=\"${active?'#EAF1EF':'#7F979D'}\"", "fill=\"${active?INK:MUTED}\""],
]

for (const [from, to] of swaps) {
  if (!html.includes(from)) {
    console.warn('MISSING', JSON.stringify(from).slice(0, 80))
  } else {
    html = html.split(from).join(to)
  }
}

const destHtml = 'public/asset/mula-mutha-bod-cod.html'
const destJson = 'public/asset/dashboard_data.json'
fs.writeFileSync(destHtml, html)

const fb = html.match(/<script id="fallback"[^>]*>([\s\S]*?)<\/script>/)[1]
const data = JSON.parse(fb)
data.class_colors = LIGHT_CLASS
fs.writeFileSync(destJson, JSON.stringify(data))

const r0 = data.reaches[0]
console.log('wrote', destHtml, fs.statSync(destHtml).size)
console.log('wrote', destJson, fs.statSync(destJson).size)
console.log('resolution', data.timeline_resolution, 'hist', r0.history.dates.length, 'fc', r0.forecast.dates.length)
console.log('hours', data.history_hours, data.forecast_hours)
console.log('has light root', html.includes('--water:#e9f1f7'))
console.log('has CLASS_COLORS inject', html.includes("const CLASS_COLORS = {A:'#1668b3'"))
console.log('dark leftover water', html.includes('--water:#0B171D'))
console.log('dark leftover EAF1EF count', (html.match(/#EAF1EF/g) || []).length)
console.log('IBM leftover', (html.match(/IBM Plex/g) || []).length)
console.log('Fraunces leftover', html.includes('Fraunces'))
