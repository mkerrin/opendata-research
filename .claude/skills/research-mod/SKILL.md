---
name: research-mod
description: Show which open-data research topic (data/<topic>/) the session is on, and list that topic's datasets, fields and provenance in the Datasets side pane. Use when asked to load, open, switch to or show a research topic or its datasets, or to explain the "Researching:" status line or the /datasets pane.
---

# Datasets

This folder is a skill and a Claude Code mod named `research-mod`. Claude Code loads both
automatically from the project's `.claude/skills/research-mod/`. The mod shows the current
research topic and its datasets. It only reads files: it never fetches, downloads or writes
data. That is the `opendata-research` skill's job.

## Loading or switching a topic

The topic is the first `data/<topic>/` path a tool call names in `file_path`, `path`,
`command` or `notebook_path`. The trailing slash is required: `data/electricity-prices/`
matches, `data/electricity-prices` does not. To load or switch topic, name a path under it:

```sh
ls /home/michael/src/opendatamcp/data/<topic>/
```

The status line then reads `Researching: <topic>`, and the **Datasets** pane opens.

After loading a topic, give a short summary of what the pane shows. Read each
`data/<topic>/*/source.json` and report its title, source, number of snapshots, latest
snapshot and latest period. Skip `dashboard-*` folders.

## The pane

- `/datasets` opens it. It also opens by itself when the topic changes.
- Each dataset folder under the topic, except `dashboard-*`, is read from its `source.json`.
  The pane shows the dataset's title, source, latest period, upstream update, latest snapshot,
  publisher, units, notes, fields and measures.
- Folders a tool call named this session are marked ● and listed first, open. Press `c` to
  collapse all and `e` to expand all.
- `source.json` is read again after every tool call under the topic.

## Depends on

The pane reads the `source.json` keys that `opendata-research` and its `describe_fields.py`
write: `snapshots[]` (`file`, `fetched_at`, `upstream_updated`, `latest_period`, `rows`),
`fields[]` (`name`, `role`, `categories`, `min`/`max`, `blanks`, `distinct`, `first`/`last`)
and `measures[]` (`statistic`, `unit`, `min`/`max`). If you change one side, change the
other to match.
