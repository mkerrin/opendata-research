"""Build <dir>/standalone.html from a saved dashboard folder.

    python3 -I build_standalone.py data/<topic>/dashboard-<name>

The folder holds index.html (the dashboard page, unchanged from claude.ai),
dashboard.json (title, link, datasets) and each dataset's local data file.
The output inlines d3, every dataset and a small stand-in for the claude.ai
dashboard runtime (`dash`), so it opens offline in any browser.
"""
import html as htmllib
import json
import sys
from datetime import date
from pathlib import Path

SKILL = Path(__file__).resolve().parent
D3 = (SKILL / "vendor" / "d3.v7.9.0.min.js").read_text()

if len(sys.argv) != 2:
    sys.exit(__doc__)
DIR = Path(sys.argv[1]).resolve()
META = json.loads((DIR / "dashboard.json").read_text())
PAGE = (DIR / "index.html").read_text()

FORMATS = {".csv": "csv", ".tsv": "tsv", ".json": "json"}
blocks = []
for ds_id, ds in META["datasets"].items():
    local = DIR / ds["local_file"]
    fmt = FORMATS.get(local.suffix.lower())
    if not fmt:
        sys.exit(f"{ds_id}: unsupported data file {local.name} (csv, tsv or json)")
    text = local.read_text()
    if "</script" in text.lower():
        sys.exit(f"{ds_id}: {local.name} contains '</script' and cannot be inlined")
    blocks.append(f'<script type="text/plain" class="dash-data" data-id="{htmllib.escape(ds_id)}" '
                  f'data-format="{fmt}">{text}</script>')
if "</script" in D3.lower():
    sys.exit("d3 contains '</script' and cannot be inlined")

TOKENS = """
:root {
  color-scheme: light;
  --font-anthropic-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-anthropic-serif: Georgia, "Times New Roman", serif;
  --color-bg: #f9f9f7; --color-panel: #fcfcfb; --color-fg: #0b0b0b;
  --color-fg-muted: #6b6a66; --color-border-line: #e1e0d9;
  --color-ok: #006300; --color-warn: #8a5a00; --color-bad: #d03b3b;
  --cds-text-secondary: #52514e;
  --cds-chart-grid: #e8e7e1; --cds-chart-axis: #c3c2b7; --cds-chart-reference: #898781;
  --cds-chart-muted: #c3c2b7; --cds-chart-status-critical: #d03b3b;
  --cds-surface-popover: #ffffff; --cds-border: rgba(11,11,11,.12);
  --cds-shadow-popover: 0 4px 16px rgba(0,0,0,.10);
  --cds-font-size-caption: 0.75rem; --cds-font-size-body: 0.9375rem;
  --cds-font-size-heading: 1.0625rem; --cds-font-size-title: 1.875rem;
  --cds-font-weight-medium: 600;
  --cds-gap-xs: 4px; --cds-gap-sm: 8px; --cds-gap-md: 12px; --cds-gap-lg: 20px; --cds-gap-xl: 32px;
  --cds-pad-xs: 4px; --cds-pad-sm: 8px; --cds-pad-md: 12px; --cds-pad-lg: 20px; --cds-pad-xl: 32px;
  --cds-radius: 8px; --cds-dur-slow: 300ms; --cds-ease-out: cubic-bezier(.2,.8,.2,1);
  --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a; --s4: #eda100;
  --s5: #e87ba4; --s6: #008300; --s7: #6250d6; --s8: #e34948;
}
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --color-bg: #0d0d0d; --color-panel: #1a1a19; --color-fg: #f0efec;
    --color-fg-muted: #a3a29a; --color-border-line: #2c2c2a;
    --color-ok: #0ca30c; --color-warn: #fab219; --color-bad: #e66767;
    --cds-text-secondary: #c3c2b7;
    --cds-chart-grid: #2c2c2a; --cds-chart-axis: #383835; --cds-chart-reference: #898781;
    --cds-chart-muted: #4a4a46; --cds-chart-status-critical: #e66767;
    --cds-surface-popover: #232322; --cds-border: rgba(255,255,255,.12);
    --cds-shadow-popover: 0 4px 16px rgba(0,0,0,.5);
    --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500;
    --s5: #d55181; --s6: #008300; --s7: #9085e9; --s8: #e66767;
  }
}
html, body { margin: 0; background: var(--color-bg); color: var(--color-fg);
  font-family: var(--font-anthropic-sans); }
#dash-root { max-width: 1100px; margin-inline: auto; padding-block: 24px 32px;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.sa-foot { margin-top: 20px; font-size: 0.75rem; color: var(--color-fg-muted); overflow-wrap: anywhere; }
.sa-foot a { color: inherit; }
"""

# Stand-in for the dashboard runtime: all data is inline, so every dataset is
# "ok" at once and calcs run eagerly in the order the page declares them.
SHIM = """
(function () {
  const store = {};
  document.querySelectorAll('script.dash-data').forEach((el) => {
    const f = el.dataset.format, t = el.textContent;
    let rows = f === 'json' ? JSON.parse(t) : f === 'tsv' ? d3.tsvParse(t) : d3.csvParse(t);
    if (!Array.isArray(rows)) rows = rows.rows || rows.data || rows.results || rows;
    store[el.dataset.id] = rows;
  });
  const listeners = [];
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const params = {};
  window.dash = {
    get colors() { return ['--s1','--s2','--s3','--s4','--s5','--s6','--s7','--s8'].map(css); },
    calc(id, spec) { store[id] = spec.fn(...spec.inputs.map((i) => store[i])); },
    data(id) {
      const d = store[id];
      return d !== undefined
        ? { status: 'ok', data: d, rows: d, columns: d.columns || Object.keys((Array.isArray(d) && d[0]) || {}), refreshing: false, meta: [] }
        : { status: 'missing', data: [], rows: [], columns: [], refreshing: false, meta: [] };
    },
    onData(fn) { listeners.push(fn); fn(); },
    params() { return { ...params }; },
    setParams(p) { Object.assign(params, p); rerun(); },
    resetParams() { for (const k in params) delete params[k]; rerun(); },
    refresh() {}, setLink() {}, loader() {},
  };
  function rerun() { listeners.forEach((fn) => fn()); }
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(rerun, 150); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rerun);
})();
"""

esc = htmllib.escape
title = META["title"]
foot = [esc(META.get("attribution", ""))]
foot.append("Data: " + ", ".join(esc(d["local_file"]) for d in META["datasets"].values()) + ".")
foot.append(f"Built {date.today().isoformat()}.")
if META.get("artifact_url"):
    foot.append(f'Online version: <a href="{esc(META["artifact_url"])}">claude.ai artifact</a>.')

out = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(title)}</title>
<style>{TOKENS}</style>
<script>{D3}</script>
{chr(10).join(blocks)}
<script>{SHIM}</script>
</head>
<body>
<div id="dash-root">
{PAGE}
<p class="sa-foot">{" ".join(f for f in foot if f)}</p>
</div>
</body>
</html>
"""
(DIR / "standalone.html").write_text(out)
print(f"wrote {DIR / 'standalone.html'} ({len(out):,} bytes)")
