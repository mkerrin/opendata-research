---
name: save-dashboard
description: Build or save a chart, report or dashboard made from open data as a local self-contained HTML file in the data directory, with its data, a record of where it came from, and an offline standalone.html that opens in any browser. Use when asked to chart, report on or make a dashboard of data under data/, or to save, keep, export, back up or make an offline/standalone copy of a dashboard, chart or claude.ai artifact. Builds locally first and asks before publishing anything to claude.ai.
---

# Save a dashboard to the data directory

Online artifacts can be deleted or lose access, so every dashboard or chart
built from this workspace's data lives on disk, next to the data it came
from. Keep it rebuildable: a saved dashboard is its page code, its data,
and a record linking both back to the raw snapshot (see the
`opendata-research` skill for snapshots and `notes.org`).

**Reports are local first.** A new report, chart or dashboard is built on
disk as a self-contained `standalone.html` (below). **Never publish to
claude.ai without asking**: no Artifact publish, type create, asset upload
or ArtifactData write until the user says yes to publishing (see the guard
below). An online copy is optional. The local folder is always kept.

## Layout

```
data/<topic>/
  notes.org                        # research log: link the dashboard here
  <source>-<id>/YYYY-MM-DD.csv     # raw snapshots (opendata-research)
  dashboard-<name>/                # one folder per dashboard, kebab-case name
    index.html                     # the page (the same text that is, or would be, published)
    <dataset>.csv|tsv|json         # each dataset the page reads, cut from the raw snapshot
    dashboard.json                 # title, link if published, datasets, provenance
    standalone.html                # built: offline copy, opens in any browser
```

Examples: `data/rental-housing/dashboard-county-rents/`,
`data/irish-budget/dashboard-spending/`.

## Building a report locally (the default)

1. **Data**: a script in `data/<topic>/` (e.g. `make_dashboard_data.py`)
   cuts the latest raw snapshot into the dataset file(s) and prints which
   snapshot it used. Keep files small: drop columns and rows the page
   doesn't use, and drop suppressed (blank) values.
2. **Page**: write `index.html` as a Dashboard page body (no `<html>`/`<head>`):
   `<style>`, markup with `data-source` marks, and `<script>` using
   `dash.data(id)`, `dash.calc`, `dash.onData`, `dash.colors`,
   `dash.params`/`setParams` and the `d3` global. Written this way, the same
   file can be published later without changes. Prefix your classes and
   don't style bare tags. **Default every filter in code**
   (`dash.params().x ?? 'default'`). Offline the params start empty, because
   `dash/params` exists only online. Load the `dataviz` skill before
   choosing chart forms and colours.
3. **Sources section at the top**: every report opens with a "Sources" card,
   straight after the title and lede and before any filters, tiles or charts.
   Take its facts from each dataset's `source.json`, not from memory. Write
   it as static markup (a `<dl>`), not `data-source` marks, so it shows even
   when data fails to load. For each source give:
   - **Data**: the publisher and the table or file, linked to its landing
     page (e.g. RTB via CSO table RIQ02, https://data.cso.ie/table/RIQ02).
   - **Coverage**: the measure and units, the time span, and the geography
     and breakdowns the page uses.
   - **Retrieved**: the snapshot date, and the date the publisher last
     updated it (`upstream_updated`).
   - **Notes**: the caveats a reader needs, such as what the figures do and
     don't measure, suppressed values being dropped, a missing national
     total, or a licence restriction (e.g. RTB files with no open licence).
   Example: `data/rental-housing/dashboard-county-rents/index.html`.
4. **`dashboard.json`**: see the format below, with `"artifact_url": null`
   while it is local only.
5. **Build** `standalone.html`, **check it renders**, and **log it**: steps
   4–6 under "Saving a claude.ai Dashboard artifact" below.
6. **Ask about publishing** (guard below), but only after the local copy is
   built and checked.

## Guard: ask before publishing to claude.ai

Publishing sends the data and page to claude.ai, where anyone it is shared
with can open and download them. It is the user's call, every time.

- **After** the local report is built and checked, ask with `AskUserQuestion`,
  for example:
  *"The report is saved at `data/<topic>/dashboard-<name>/standalone.html`.
  Publish it to claude.ai as an artifact as well?"* with the options
  **"Keep it local (Recommended)"** and **"Publish to claude.ai"**.
- Until the user picks "Publish" in this conversation, make **none** of
  these calls: Artifact `publish` (including `type_url` creates and
  `asset: true` uploads) and ArtifactData writes. A read-only Artifact
  `quickstart` or `read`, or reading an existing artifact to save it, is fine.
- "Chart this", "make a dashboard", "show me", "save it" or "share it" are
  **not** a yes to publishing. Build locally and ask. A yes for one report
  does not carry over to the next report or to a later republish (including
  one after a data refresh). Ask again.
- If the user says yes: publish from the local folder (Dashboard type:
  attach the dataset files, write `index.html` as `files/index.html`), then
  set `artifact_url` in `dashboard.json`, rebuild `standalone.html` so its
  footer links the online copy, and add the link to `notes.org`.
- If the user declines, or doesn't answer in a background job, leave the
  report local. Say where it is, and that it can be published on request.

## Saving a claude.ai Dashboard artifact

For a dashboard that is already online (published earlier, or by someone
else). Saving reads the artifact and writes only local files, so it needs
no publishing approval.

1. **Page**: read the artifact's `files/index.html` document (Artifact
   `read_db`, `collection: files`, with `out_dir` in the scratchpad), then
   write its `text` to `index.html` unchanged. If the page has no Sources
   section (step 3 of "Building a report locally"), add one to the local `index.html` after saving,
   bump `page_version`, and say so. The online copy only changes if the user
   agrees to republish.
2. **Data**: read `datasets` the same way. For each dataset, save the file it
   points to next to `index.html`. Use the local file you uploaded if you
   still have it, and check that it is the same file. A trimmed or reshaped
   file is fine here: it's derived data, and the raw snapshot stays in
   `<source>-<id>/`.
3. **`dashboard.json`**:
   ```json
   {
     "title": "Irish Government Spending to 2026Q1",
     "artifact_url": "https://claude.ai/artifact/<id>",
     "artifact_type": "Dashboard (https://claude.ai/artifact/GZLZthZ2sQjn7T16skfdeF)",
     "page_version": 3,
     "saved_at": "YYYY-MM-DD",
     "attribution": "Source: CSO table GFQ04, ..., € million (https://data.cso.ie/table/GFQ04).",
     "datasets": {
       "<dataset id as the page uses it>": {
         "title": "...", "description": "...",
         "source": { "...": "the artifact's dataset source, as stored" },
         "local_file": "gfq04_spending.csv",
         "derived_from": "../cso-GFQ04/2026-10-18.csv"
       }
     }
   }
   ```
   - The keys under `datasets` must be the ids the page passes to
     `dash.data(...)` and `dash.calc` inputs.
   - `derived_from` points at the raw snapshot the data was cut from.
   - `attribution` is the footer line of the standalone page: name the publisher, table and units.
   - For a local-only report, `artifact_url` is `null` and `artifact_type`
     and `source` can be left out. The builder needs only `title`,
     `attribution` and each dataset's `local_file`.
4. **Build the offline copy**:
   ```sh
   python3 -I .claude/skills/save-dashboard/build_standalone.py data/<topic>/dashboard-<name>
   ```
   It inlines d3 (bundled in `vendor/`, so no network is needed), every
   dataset, light and dark theme tokens, and a stand-in for the dashboard's
   `dash` runtime. Supported features: `dash.data`, `dash.calc`, `dash.onData`,
   `dash.colors` and `dash.params`/`setParams`. Live queries, loaders and refresh
   do nothing offline.
5. **Check it renders**: serve the folder (`python3 -I -m http.server <port>
   --bind 127.0.0.1` in the background) and open `standalone.html` with the
   Playwright browser. Playwright blocks `file://`. Take one screenshot under
   `.playwright-mcp/`, look at it, then delete it and stop the server.
6. **Log it** in `data/<topic>/notes.org`, under the question's `*** Outputs`:
   `[[file:dashboard-<name>/standalone.html]]`, and the artifact link if it is published.

## Charts made locally (not dashboards)

Use the same folder shape with whatever exists. A matplotlib or d3 chart
script and its PNG/HTML output go in `dashboard-<name>/` (or straight in
`data/<topic>/` for a single plot). The script reads the latest raw snapshot
and prints which file it used, so re-running it after a refresh picks up the
new data. Record it in `notes.org` the same way.

## Keeping it current

- **When the data is refreshed** (new snapshot), regenerate the trimmed
  dataset file from the new snapshot, update `derived_from`, update the
  Sources section's coverage and retrieved/updated dates, and rebuild
  `standalone.html`. If the artifact is still online, ask before
  republishing it (guard above). The earlier yes doesn't cover this.
- **When the page is edited online**, save `index.html` again, bump
  `page_version`, and rebuild.
- **If the artifact is deleted or no longer accessible**, keep the folder.
  Add `"artifact_status": "deleted YYYY-MM-DD"` to `dashboard.json` and
  note it in `notes.org`. The page can be republished from `index.html` and
  its data files, but only after asking.
- Never edit `standalone.html` by hand. Change `index.html` or the data and rebuild.
