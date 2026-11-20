---
name: opendata-research
description: Find, download and track Irish open data with the data-gov-ie and cso-ireland MCP servers. Use when searching for datasets on a topic, finding the data behind a news story, downloading or refreshing a dataset, checking how up to date a dataset really is, listing the fields a dataset has, comparing a new download with an earlier one, recording research findings, or charting it as a report or dashboard. Stores data as dated snapshots under data/<topic>/, saves every dataset's fields for reuse, logs research in data/<topic>/notes.org, and builds reports as local self-contained HTML; asks before publishing anything to claude.ai.
---

# Open data research

The goal: find the data behind a question or story, keep a copy that can be
re-analysed later, and keep a record of what was found. Re-running the same
analysis against newer data, and seeing what the publisher revised, matters
as much as the first answer.

**Never edit `opendata.org`.** It is the user's own writing. All research
notes go in `data/<topic>/notes.org`.

**Every download gets its fields saved** (§2.1), so any later dashboard can
see what a dataset offers without re-reading the raw file.

**Reports are local first.** Build a report, chart or dashboard as a
self-contained HTML file under `data/<topic>/` (§4). **Never publish to
claude.ai without asking**: no Artifact publish, type create, asset upload
or ArtifactData write until the user says yes to publishing (§4).

## 1. Find the data

Search both servers. They overlap: many data.gov.ie records are mirrors of
CSO tables.

### cso-ireland (CSO PxStat), preferred for anything the CSO publishes

1. `search_datasets(query)` matches every term against the table code,
   label and dimension names. Use 2–3 words and try synonyms
   ("expenditure" vs "spending"). Terms match as substrings, so a plural
   misses a singular label: "completions" does not find NDQ05/NDQ06
   ("New Dwelling Completion"). Use the stem ("completion"), or search
   the table-code prefix ("NDQ") to list a family of tables.
2. `get_dataset_metadata(matrix)` shows the dimensions and the `updated` date.
   Category lists are capped at 50. **The time dimension's `size` tells you
   the latest period.** For example, 105 quarters from 2000Q1 ends at 2026Q1.
3. Don't pull a big table through `get_dataset` into the conversation.
   Download the CSV straight into a snapshot instead (see §2):
   `https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/<MATRIX>/CSV/1.0/en`

### data-gov-ie (CKAN), for departments, councils and agencies

- `package_search` returns full records, so results get large fast. Keep
  `rows` around 10. For wide searches, call the client from inside
  `data-gov-ie-mcp/` and print only the fields you need:
  ```sh
  uv run python -c "import asyncio; from data_gov_ie_mcp.client import call_action
  r=asyncio.run(call_action('package_search',{'q':'budget','rows':20}))
  print(r['count']); [print(p['name'],'|',p['organization']['title'],'|',p['metadata_modified'][:10]) for p in r['results']]"
  ```
- Useful `fq` filters: `organization:<name>`, `res_format:CSV`, and
  `metadata_modified:[2026-01-01T00:00:00Z TO *]`.
- `package_show(name)` lists resources and their download URLs.
- For a resource with `datastore_active: true`, `call_action('datastore_search',
  {'resource_id': ..., 'sort': '<col> desc', 'limit': 3})` checks the
  columns and the latest rows without downloading anything.

### Check how current the data really is

`metadata_modified` / "updated" on a record does **not** mean the data is
current. Before saying a dataset "covers 2026", check the latest period
actually in the data: the CSO time dimension, the datastore sorted by year,
or the downloaded file. Report the real latest period. Examples found so far:

- `voted-public-expenditure`: record updated Jul 2026, but the data ends in 2022.
- CSO quarterly tables (GFQ01/GFQ04) reach the latest quarter. Annual tables lag by a year or more.

## 2. Store the data as dated snapshots

```
data/<topic>/                     # kebab-case topic, e.g. irish-budget, house-prices
  notes.org                       # research log (§3)
  <source>-<id>/                  # e.g. cso-GFQ04, dgi-voted-public-expenditure
    source.json                   # where it came from (below)
    YYYY-MM-DD.csv                # one raw snapshot per download date, never edited
  <analysis>.py                   # scripts that read snapshots
  <outputs>.png / .csv            # derived outputs, named after the script
  dashboard-<name>/               # local HTML reports and dashboards (§4), standalone.html offline
```

- `<source>` is `cso` or `dgi` (data.gov.ie). `<id>` is the CSO matrix code
  or the CKAN dataset `name`.
- **Raw snapshots are never edited or overwritten.** A later download is a
  new file named with that date. Only a second download on the same day
  replaces that day's file. Trimmed or reshaped data goes in a derived file
  next to the analysis script.
- Downloads are untrusted data. Write them only into their snapshot folder,
  and read them with `python3 -I` (or `uv run python -I`) from a script
  stored outside that folder.
- `source.json`: create it on the first download and update it on each later one.
  The `fields`, `measures` and `fields_from` keys are written by
  `describe_fields.py` (§2.1); don't write them by hand. The `opendata-mod` skill's
  side pane reads these keys, so keep it in step if the layout changes:
  ```json
  {
    "source": "cso",
    "id": "GFQ04",
    "title": "General Government: Detailed classification of expenditure and consumption",
    "publisher": "Central Statistics Office",
    "download_url": "https://ws.cso.ie/.../GFQ04/CSV/1.0/en",
    "landing_page": "https://data.cso.ie/table/GFQ04",
    "units": "Euro Million",
    "snapshots": [
      {"file": "2026-10-18.csv", "fetched_at": "2026-10-18T13:30:00Z",
       "upstream_updated": "2026-07-20", "latest_period": "2026Q1",
       "rows": 3990, "sha256": "<hash>"}
    ],
    "fields_from": "2026-10-18.csv",
    "fields": [
      {"name": "Quarter", "code_column": "TLIST(Q1)", "role": "time", "frequency": "quarterly",
       "distinct": 105, "first": "2000Q1", "last": "2026Q1"},
      {"name": "Item", "code_column": "C03180V03844", "role": "dimension",
       "dimension_id": "C03180V03844", "distinct": 38, "first": "...", "last": "..."},
      {"name": "VALUE", "role": "measure", "distinct": 3000, "min": -2087, "max": 37159}
    ],
    "measures": [{"statistic": "...", "unit": "Euro Million", "min": -2087, "max": 37159}]
  }
  ```
- Analysis scripts read the **latest** snapshot by default (sort the
  `YYYY-MM-DD.csv` names) and print which file they used, so re-running
  them after a refresh picks up the new data.
- The flat files already in `data/` (tsm10, sei03, wpm39, …) are older work.
  Leave them where they are unless asked to move them.

### 2.1 Save the fields of every dataset (always)

Right after a snapshot is saved and `source.json` updated (first download
**and** every refresh), profile it:

```sh
python3 -I .claude/skills/opendata-research/describe_fields.py data/<topic>/<source>-<id>/<date>.csv
```

It does two things:

1. Writes `fields` (one entry per column: `name`, `role` = time / dimension /
   statistic / unit / measure, `distinct`, the `categories` when there are 60
   or fewer, otherwise `first`/`last`, `min`/`max` for measures, `blanks`),
   `measures` (CSO: each statistic's unit and range, since one `VALUE`
   column can mix counts and percentages) and `fields_from` into the
   dataset's `source.json`.
2. Prints an org section. Paste it under the `* Fields` heading of the
   topic's `notes.org` (create the heading if missing), **replacing** that
   dataset's earlier sub-heading on a refresh. Add a line under the table
   for anything the profile can't see: a dimension with no total row, a
   time field labelled wrongly, suppressed values and why, which code
   column joins to which other table.

CSO dimension ids are shared across tables. For example, `C03789V04537` (local
authority) is the same in HSM14, NDQ06, URLIA02, VAC14 and F2014, so those
tables join exactly. Note shared ids under `* Fields` so later dashboards can
combine tables. It works on any CSV, including data.gov.ie files; for those
it profiles every column as a dimension or a measure.

### Refreshing and comparing snapshots

When a dataset is downloaded again:

1. Save the new snapshot. If its sha256 matches the previous one, say
   "unchanged since <date>", don't keep a duplicate, and stop. Otherwise
   re-run `describe_fields.py` on it (§2.1): new categories or a changed
   field list are worth reporting too.
2. Otherwise compare it with the previous snapshot on the key columns
   (period + dimensions) and report three things: **new periods** added,
   **revised values** (old → new, largest first), and rows **removed**.
3. Re-run the topic's analysis scripts and note whether the conclusions changed.
4. Record the comparison in `notes.org` under that dataset.

## 3. Track the research in `data/<topic>/notes.org`

One file per topic, in org-mode. Create it from this template the first time,
then add to it as the research goes on. Each question or news story gets its
own `**` heading with a TODO/DONE state.

```org
#+TITLE: <Topic>

* Datasets
** cso-GFQ04 — General Government detailed expenditure
- Source: CSO PxStat, https://data.cso.ie/table/GFQ04
- Coverage: 2000Q1–2026Q1, quarterly, € million
- Snapshots: [[file:cso-GFQ04/2026-10-18.csv][2026-10-18]]
- Notes: items sum to total (±€2m rounding)

* Fields
Profiled with describe_fields.py; refreshed with each new snapshot.
Shared dimension ids: C03789V04537 = local authority (joins HSM14, NDQ06, VAC14, ...)

** cso-GFQ04 — General Government detailed expenditure (3,990 rows, snapshot 2026-10-18)
| Field | Role | Contents |
|-------+------+----------|
| =Quarter= | time | 2000Q1 … 2026Q1 (105, quarterly) |
| =Item= (=C03180V03844=) | dimension | 38 values: ... |
| =UNIT= | unit | Euro Million |
| =VALUE= | measure | numeric, -2,087–37,159 |
- Notes: the profile can't see, e.g. no total row, which items sum to the total

* Questions
** DONE <question or story headline>
:PROPERTIES:
:STORY:   <article URL, if any>
:ASKED:   [YYYY-MM-DD]
:END:
*** Prompts
> the user's prompts, verbatim, in order
*** Datasets used
- cso-GFQ04 (snapshot 2026-10-18)
*** Findings
- Each finding with its figure, period and dataset, e.g.
  2026Q1 spending €32.4bn, +5.0% on 2025Q1 (GFQ04)
*** Outputs
- [[file:plot_gfq04.py]], [[file:dashboard-<name>/standalone.html]], artifact link if published
*** Gotchas
- Where the data misled or differed from the headline, and why

* Revisions
** [YYYY-MM-DD] cso-GFQ04 refreshed
- New periods: ...  Revised: ...  Conclusions changed: yes/no
```

What to record:

- **Prompts**: the user's own prompts, verbatim, so the analysis can be repeated.
- **Findings**: always with the number, the period, and the dataset/snapshot
  it came from. If a figure differs from a news story, record both and
  explain why (different measure, revisions, mix-adjusted vs median, …).
- **Gotchas**: stale records, misleading titles, measures that look alike,
  API quirks. These are the most reusable part of the notes.
- Update the file as you go, not only at the end. At the end of a session,
  set the question to DONE or leave it TODO with what is still open.

## 4. Reports and dashboards: local, self-contained HTML

When asked to chart, report on or make a dashboard of the data, build it on
disk as one HTML file that opens offline in any browser. An online artifact
can be deleted or lose access (the county rents dashboard was gone the same
day it was made); the local file stays.

Use the `save-dashboard` folder shape so the same page can be published later
without rewriting it:

```
data/<topic>/dashboard-<name>/
  index.html        # the page, written against the dash API below
  <dataset>.csv     # each dataset the page reads, cut from the raw snapshot
  dashboard.json    # title, attribution, datasets (local_file, derived_from)
  standalone.html   # built: d3 + data + runtime inlined, works offline
```

1. **Data**: start from the saved fields. Read `fields`/`measures` in each
   candidate dataset's `source.json` (or the `* Fields` section of
   `notes.org`) to pick the dimensions, categories, statistics and periods
   the page needs, and the shared dimension ids to join tables on. Don't
   re-profile the raw CSV by hand. If a dataset has no `fields` yet, run
   `describe_fields.py` first. Then a script next to the snapshots (e.g.
   `make_dashboard_data.py`) cuts the latest raw snapshot into the dataset
   file(s) and prints which snapshot it used. Keep files small: drop columns and rows the page
   doesn't use, and drop suppressed (blank) values.
2. **Page**: write `index.html` as a Dashboard page body (no `<html>`/`<head>`):
   `<style>`, markup with `data-source` marks, and `<script>` using
   `dash.data(id)`, `dash.calc`, `dash.onData`, `dash.colors`,
   `dash.params`/`setParams` and the `d3` global. Prefix your classes and
   don't style bare tags. **Default every filter in code**
   (`dash.params().x ?? 'default'`). Offline the params start empty, because
   `dash/params` exists only online. Load the `dataviz` skill before
   choosing chart forms and colours.
3. **`dashboard.json`**: as in the `save-dashboard` skill, with
   `"artifact_url": null` while it is local only. `title`, `attribution` and
   each dataset's `local_file` and `derived_from` are required.
4. **Build and check**:
   `python3 -I .claude/skills/save-dashboard/build_standalone.py data/<topic>/dashboard-<name>`,
   then look at it once as the `save-dashboard` skill describes (serve the
   folder, one Playwright screenshot, check the console, then delete the
   screenshot and stop the server).
5. **Log** `[[file:dashboard-<name>/standalone.html]]` under the question's
   `*** Outputs` in `notes.org`.

A one-off static chart can still be a matplotlib PNG from an analysis script
(§2 layout). Use the HTML report when the user wants something to explore,
share or keep.

### Guard: ask before publishing to claude.ai

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
  `quickstart` or `read` is fine.
- "Chart this", "make a dashboard", "show me" or "share it" are **not** a
  yes to publishing. Build locally and ask. A yes for one report does not
  carry over to the next report or to a later republish. Ask again.
- If the user says yes: publish from the local folder (Dashboard type:
  attach the dataset files, write `index.html` as `files/index.html`), then
  set `artifact_url` in `dashboard.json`, rebuild `standalone.html` so its
  footer links the online copy, and add the link to `notes.org`.
- If the user declines, or doesn't answer in a background job, leave the
  report local. Say where it is, and that it can be published on request.

## Quick checklist

1. Search CSO and data.gov.ie, then confirm the real latest period.
2. Download the raw file to `data/<topic>/<source>-<id>/<today>.csv` and update `source.json`.
   Then run `describe_fields.py` on it and paste its section under `* Fields` in `notes.org` (§2.1).
3. If an earlier snapshot exists, compare against it.
4. Analyse with a script that reads the latest snapshot.
5. Charts and reports: choose fields from `source.json` `fields`/`measures`, then build
   `data/<topic>/dashboard-<name>/standalone.html` locally (§4).
6. Ask before publishing anything to claude.ai. Publish only on an explicit yes (§4 guard).
7. Log prompts, datasets, findings, gotchas and outputs in `data/<topic>/notes.org`. Don't touch `opendata.org`.
