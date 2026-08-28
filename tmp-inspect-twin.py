import re
import urllib.request

html = urllib.request.urlopen(
    "https://riverdigitaltwin-production.up.railway.app/", timeout=30
).read().decode("utf-8", "replace")
print("len", len(html))
for tag in re.findall(r"<script[^>]*>", html)[:30]:
    print(tag)
print("---urls---")
for url in re.findall(r"https?://[^\"']+", html)[:50]:
    print(url)
print("---chart---")
print("Chart.js failed" in html, "chart.js" in html.lower())
open("tmp-twin-home.html", "w", encoding="utf-8").write(html)
print("wrote tmp-twin-home.html")
