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
- git

## Install

1. Clone this repo, then clone the three servers inside it:

   ```sh
   git clone git@github.com:mkerrin/opendata-research.git opendatamcp
   cd opendatamcp
   git clone git@github.com:mkerrin/cso-ie-mcp.git
   git clone git@github.com:mkerrin/data-gov-ie-mcp.git
   git clone git@github.com:mkerrin/eurostat-mcp.git
   ```

2. Install each server's dependencies:

   ```sh
   for d in cso-ie-mcp data-gov-ie-mcp eurostat-mcp; do (cd $d && uv sync); done
   ```

3. Create `.mcp.json` in the `opendatamcp` folder to register the servers. Replace
   `/path/to/opendatamcp` with the full path to your clone:

   ```json
   {
     "mcpServers": {
       "cso-ireland": {
         "type": "stdio",
         "command": "uv",
         "args": ["--directory", "/path/to/opendatamcp/cso-ie-mcp", "run", "python", "main.py"]
       },
       "data-gov-ie": {
         "type": "stdio",
         "command": "uv",
         "args": ["run", "--directory", "/path/to/opendatamcp/data-gov-ie-mcp", "data-gov-ie-mcp"]
       },
       "eurostat": {
         "type": "stdio",
         "command": "uv",
         "args": ["run", "--directory", "/path/to/opendatamcp/eurostat-mcp", "server.py"]
       }
     }
   }
   ```

4. Start Claude Code in the folder and approve the three servers when it asks:

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

- After updating a server's code, run `/mcp` and reconnect it, or restart Claude Code. A
  running server keeps the old code.
- Eurostat datasets can be very large. Ask for specific countries and years.
- `CLAUDE.md` has the technical details of how the workspace and servers fit together.
