# opendata-research

Research Irish and EU open data from inside [Claude Code](https://claude.com/claude-code).

This workspace connects Claude to three public statistics sources through MCP servers. It also
adds project skills that find datasets, save dated snapshots, keep research notes and build
offline HTML dashboards.

| Source | MCP server | Repo |
|---|---|---|
| CSO Ireland (PxStat) | `cso-ireland` | [mkerrin/cso-ie-mcp](https://github.com/mkerrin/cso-ie-mcp) |
| data.gov.ie (CKAN) | `data-gov-ie` | [mkerrin/data-gov-ie-mcp](https://github.com/mkerrin/data-gov-ie-mcp) |
| Eurostat (SDMX) | `eurostat` | [mkerrin/eurostat-mcp](https://github.com/mkerrin/eurostat-mcp) |

All three APIs are public and need no API key. The servers only read data.

## Requirements

- [Claude Code](https://docs.claude.com/en/docs/claude-code)
- [uv](https://docs.astral.sh/uv/) (it installs Python 3.12 if you don't have it)
- git (uv uses it to fetch the servers from GitHub)

## Install

1. Clone this repo:

   ```sh
   git clone git@github.com:mkerrin/opendata-research.git
   cd opendata-research
   ```

2. Create `.mcp.json` in the `opendata-research` folder to register the servers. `uvx`
   fetches each server from GitHub and runs it, so there is nothing to clone, install or
   `uv sync`:

   ```json
   {
     "mcpServers": {
       "cso-ireland": {
         "type": "stdio",
         "command": "uvx",
         "args": ["--from", "git+https://github.com/mkerrin/cso-ie-mcp", "cso-ie-mcp"]
       },
       "data-gov-ie": {
         "type": "stdio",
         "command": "uvx",
         "args": ["--from", "git+https://github.com/mkerrin/data-gov-ie-mcp", "data-gov-ie-mcp"]
       },
       "eurostat": {
         "type": "stdio",
         "command": "uvx",
         "args": ["--from", "git+https://github.com/mkerrin/eurostat-mcp", "eurostat-mcp"]
       }
     }
   }
   ```

   The first start is slower while uv downloads each server; after that it runs from
   uv's cache.

3. Start Claude Code in the folder and approve the three servers when it asks:

   ```sh
   claude
   ```

   Run `/mcp` to check that `cso-ireland`, `data-gov-ie` and `eurostat` are connected. The
   skills in `.claude/skills/` load on their own.

## Use

Ask questions in plain language. Claude searches CSO first, then data.gov.ie, and Eurostat
for EU comparisons. For example:

- "Find CSO data on new house completions by county"
- "How current is the rent index data, and when was it last updated?"
- "Download the vacancy data and chart it as a dashboard"
- "Compare Irish electricity prices with the EU average"

The skills can also be run by name:

| Command | What it does |
|---|---|
| `/opendata-research` | Find and download datasets, record their fields, and keep notes |
| `/save-dashboard` | Build a chart or dashboard as a self-contained HTML file that opens offline |
| `/opendata-mod` | Switch research topic. `/datasets` opens a side pane listing the topic's datasets |

### Coming back to your research

Your research stays in `data/<topic>/` between sessions. To pick it up again, start Claude
Code in the `opendata-research` folder and ask it to load the topic by name:

- "Load energy data"
- "Switch to the housing-supply research"

Claude loads the topic and summarises its datasets: where each one came from, how many
snapshots it has, and the latest period. The status line shows `Researching: <topic>`.
`notes.org` in the topic folder has the questions, findings and gotchas from earlier sessions.

### The Datasets pane

`/datasets` opens the **Datasets** side pane. It also opens by itself when you load or switch
topic. It lists each dataset in the topic with its title, source, latest period, when the
source last updated it, your latest snapshot, and its fields and measures. Datasets used in
this session are marked ● and listed first. Press `c` to collapse all and `e` to expand all.
The pane updates as soon as a new snapshot is saved.

### Refreshing the data

Ask Claude to check for new releases, for example:

- "Refresh the energy datasets"
- "Is there newer data for cso-MSM01?"

Claude downloads each dataset again as a new dated file. If nothing changed upstream it says
so and keeps no duplicate. Otherwise it reports new periods, revised values and removed rows,
re-runs the topic's scripts, notes whether the findings changed, and logs the refresh in
`notes.org`. To update a dashboard with the new data, ask Claude to rebuild it.

### Where results go

Each research topic gets its own folder under `data/`:

```
data/<topic>/
  notes.org              research log: datasets, fields, questions, findings
  cso-<TABLE>/           one folder per dataset
    source.json          where it came from, snapshots, fields
    YYYY-MM-DD.csv       dated download, never edited
  dashboard-<name>/
    standalone.html      open this in any browser
```

Downloads are never overwritten: fetching a dataset again saves a new dated file, so you can
compare releases. Dashboards are saved locally. Claude asks before publishing anything to
claude.ai.

## Notes

- To get the latest servers, fetch each one again with `--refresh`, e.g.
  `uvx --refresh --from git+https://github.com/mkerrin/cso-ie-mcp python -c ''`, then run
  `/mcp` and reconnect them or restart Claude Code. A running server keeps the old code.
- To work on a server's code, clone its repo and point `.mcp.json` at the clone with
  `"command": "uv", "args": ["run", "--directory", "/path/to/clone", "<command>"]`.
- Eurostat datasets can be very large. Ask for specific countries and years.
- `CLAUDE.md` has the technical details of how the workspace and servers fit together.
