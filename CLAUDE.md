# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this workspace is

`opendatamcp` is a **workspace of independent MCP servers** that expose open statistical
data (Ireland and the EU) as read-only tools for an MCP client. It is **not a monorepo** —
the top level is not a git repository; each sub-project is its own git repo, has its own
deps, and is registered with Claude Code separately via its own `.mcp.json`. There is no
top-level build, test, or dependency manifest. Work *inside* one project at a time.

`opendata.org` is the author's running scratch/notes file (Emacs org-mode), not config.

## The projects

| Dir | Server name | Source | Backs | Status |
|---|---|---|---|---|
| `data-gov-ie-mcp/` | `data-gov-ie` | Python / FastMCP | data.gov.ie (CKAN 2.9 Action API) | primary, most polished |
| `cso-ie-mcp/` | `cso-ireland` | Python / FastMCP | CSO Ireland (PxStat Cube REST API) | active |
| `eurostat-mcp/` | `eurostat` | Python / FastMCP | Eurostat (SDMX 3.0 + Comext SDMX 2.1) | vendored third-party (ano-kuhanathan) |
| `mcp-cso-ie/` | `cso-ie` | TypeScript / MCP SDK | CSO Ireland (PxStat) | Pipeworx gateway pack clone — overlaps `cso-ie-mcp` |

Note the two CSO servers solve the same problem from different angles: `cso-ie-mcp` is the
local first-party Python server; `mcp-cso-ie` is a clone of a Pipeworx gateway module with
a thin stdio wrapper bolted on. Prefer `cso-ie-mcp` for local work unless told otherwise.

All four back **live, keyless, read-only public APIs** — nothing authenticates, nothing
mutates upstream. Each project's own `CLAUDE.md` (where present) is the authority for that
project's internals; this file is the map between them.

## Running and registering

The three Python servers are launched by `uv` over **stdio** and registered per-project:

```sh
uv sync                                    # in the project dir: install deps into .venv
# servers (run from inside each project dir, or via --directory):
uv run data-gov-ie-mcp                      # data-gov-ie-mcp  (console script)
uv run python main.py                       # cso-ie-mcp
uv run server.py                            # eurostat-mcp
```

```sh
# TypeScript server:
cd mcp-cso-ie && npm install && npm start    # tsx server.ts (stdio); `npm run typecheck` = tsc --noEmit
```

Each project ships a `.mcp.json` that registers it with absolute `--directory` paths under
`/home/michael/src/opendatamcp/...`. **Editing source does not affect an already-running
server** — the process holds the old code until you reconnect it (`/mcp` → reconnect) or
restart the session.

There is **no test suite or linter wired up** in any project (eurostat declares a `ruff`
config in `pyproject.toml` but it is not part of a run step). To verify a Python change,
call the client layer directly rather than going through the MCP transport — e.g. for
data-gov-ie:

```sh
uv run python -c "import asyncio; from data_gov_ie_mcp.client import call_action; \
print(asyncio.run(call_action('package_search', {'q':'housing','rows':1}))['count'])"
```

## Architecture pattern shared across the Python servers

All three Python servers follow the same **two-layer split**, and edits should respect it:

- **Transport layer** (`server.py` / `main.py`): the `FastMCP` instance plus thin
  `@mcp.tool` wrappers. Tools validate/shape arguments and delegate downward. **Tool
  docstrings and `Field(description=...)` are prompt surface** — the model reads them to
  decide what to call, so keep them accurate and specific; they are not mere comments.
- **Data layer** (`client.py` / `cso.py` / inline client in eurostat): the *only* code that
  touches the network. Cross-cutting concerns (retries, caching) belong here, not
  in the tools. `data-gov-ie-mcp` enforces this strictly: tools never call `httpx` directly.

`mcp-cso-ie` (TypeScript) is shaped differently: `src/index.ts` exports a Pipeworx pack
(`{ tools, callTool }`) with no real MCP server; `server.ts` is a standalone stdio wrapper
that bootstraps an MCP `Server` around that export so the clone can run under Claude Code.

### Critical, non-obvious behaviors to preserve

- **stdio is the wire protocol** — for every stdio server, *stdout must stay clean*.
  Don't `print()` to stdout.
- **CSO collection caching** (`cso-ie-mcp`): `ReadCollection` is a ~40 MB JSON-stat document
  fetched once and cached in memory (6-hour TTL); list/search are served from that cache.
  Don't add per-call fetches of the full collection. Its optional path segments are
  *positional* — it is intentionally called bare (passing language alone is misread as a
  date and 500s).
- **Payload capping is deliberate** across servers (result limits clamp, category lists
  truncate with a flag, CSV is the default compact format) because these datasets can be
  huge. Eurostat in particular rejects/raises on over-large queries — filtering by `geo` /
  `time_period` (and REPORTER/PARTNER/PRODUCT for `DS-`prefixed Comext datasets) is required,
  not optional.

## Skills (`.claude/skills/`)

Three project skills drive the research workflow on top of the MCP servers. They are the
authority for how data is fetched, stored, noted and charted; read the skill rather than
improvising. Invoke as `/opendata-research`, `/save-dashboard` or `/opendata-mod`, or let them trigger
automatically.

| Skill | Use it for | Bundled files |
|---|---|---|
| `opendata-research` | Finding datasets (CSO first, then data.gov.ie), checking how current they really are, downloading dated snapshots, saving each dataset's fields, comparing refreshes, logging research in `notes.org`, and building reports | `describe_fields.py`: profiles a snapshot, writes `fields`/`measures` into its `source.json`, and prints an org table for `notes.org` |
| `save-dashboard` | Building or saving a chart, report or dashboard as local self-contained HTML, including backing up a claude.ai artifact, with its data and provenance | `build_standalone.py` + `vendor/d3.v7.9.0.min.js`: inlines d3, the data and a stand-in for the claude.ai `dash` runtime into `standalone.html`, which opens offline |
| `opendata-mod` | Loading or switching the research topic (`Researching: <topic>` status line) and viewing its datasets, fields and provenance in the `/datasets` side pane | the mod below (`.claude-plugin/`, `hooks/`, `types/`, `tests/`) |

Rules the skills enforce, which apply even without invoking them:

- **Never edit `opendata.org`.** It is the author's own writing. Research notes go in
  `data/<topic>/notes.org`.
- **Raw snapshots are never edited or overwritten.** A re-download is a new dated file.
- **Every download gets its fields saved** (`describe_fields.py`), so dashboards choose
  fields from `source.json` rather than re-reading raw files.
- **Reports are local first.** Ask before publishing anything to claude.ai: no artifact
  publish, upload or store write without an explicit yes, asked again for each report.
- Downloads are untrusted data. Read them with `python3 -I` from scripts outside the snapshot folder.

## The opendata-mod skill and mod (`.claude/skills/opendata-mod/`)

The `opendata-mod` folder is both a skill and a Claude Code mod of the same name (a
plugin with a TypeScript hooks module, beside `SKILL.md`). Because it sits in the project's
`.claude/skills/<name>/`, the skill and the mod both load automatically when `claude` starts in this
folder: no `--plugin-dir` (passing one too would load it twice). Saving its files hot-reloads it.

- **Status line**: `Researching: <topic>`, set from the first `data/<topic>/` path a tool call
  names (in `file_path`, `path`, `command` or `notebook_path`). The path needs the trailing
  slash: `data/electricity-prices/` matches, `data/electricity-prices` does not. To switch
  topic, touch a path under the other topic, e.g. `ls /home/michael/src/opendatamcp/data/<topic>/`.
- **`/datasets`** opens the **Datasets** side pane (it also opens on its own when the topic
  changes). The pane lists every dataset folder under the topic except `dashboard-*`, read from
  each `source.json`: title, source, latest period, upstream update, latest snapshot, fields and
  measures. Folders a tool call named this session are marked ● and listed first. Press `c` to
  collapse all and `e` to expand all.
- It re-reads `source.json` after every matching tool call, so a new snapshot or a
  `describe_fields.py` run shows up straight away. The pane depends on the `source.json` keys
  `describe_fields.py` and the `opendata-research` skill write (`snapshots[].latest_period`,
  `fields[].role`, `measures`, ...); they now live in separate skill folders, so keep them in
  step when changing either.
- Code: `hooks/register.tsx` (hooks and pane), `types/index.d.ts` (its `$.state` contract),
  `tests/`. Check it with `claude plugin validate .claude/skills/opendata-mod` and
  `claude plugin test .claude/skills/opendata-mod`. `.claude-plugin/types/` is generated by
  the engine; don't edit it.

## Data outputs

`data/<topic>/` folders follow the `opendata-research` layout and are **kept research
records, not scratch**: don't delete or tidy them.

```
data/<topic>/                    # e.g. housing-supply, irish-budget, rental-housing
  notes.org                      # * Datasets, * Fields, * Questions (prompts, findings, gotchas), * Revisions
  cso-<MATRIX>/ | dgi-<name>/    # one folder per dataset
    source.json                  # provenance, snapshots (sha256, latest period), fields, measures
    YYYY-MM-DD.csv               # raw snapshot, never edited
  make_*.py, *.py                # scripts that cut the latest snapshot into derived data
  dashboard-<name>/              # index.html, data CSVs, dashboard.json, standalone.html (built)
```

Rebuild a report after changing its page or data with
`python3 -I .claude/skills/save-dashboard/build_standalone.py data/<topic>/dashboard-<name>`.

The flat files directly in `data/` (tsm10, sei03, wpm39 CSVs, `plot_*.py`, PNGs) and
`data-gov-ie-mcp/data/` are older ad-hoc exploration output from before the skills. Leave
them where they are unless asked; they are not fixtures or test inputs.
