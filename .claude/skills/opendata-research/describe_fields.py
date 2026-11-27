"""Profile the fields of a downloaded snapshot and save them for reuse.

    python3 -I .claude/skills/opendata-research/describe_fields.py data/<topic>/<source>-<id>/<date>.csv [...]

For each snapshot:
- writes a "fields" list into the dataset's source.json (machine-readable: one
  entry per column with its role, label, categories or range, blanks), a
  "measures" list for CSO tables (each statistic's unit and range), and the
  snapshot it was profiled from ("fields_from");
- prints an org-mode section for the topic's notes.org "* Fields" heading.

CSO PxStat CSVs are recognised: code columns are paired with their label
column, TLIST(...) is the time field, STATISTIC/UNIT/VALUE are the measure.
Any other CSV is profiled column by column.
"""
import csv
import json
import sys
from pathlib import Path

MAX_CATEGORIES = 60  # store every category up to this many; above it, first/last only


def is_number(v):
    try:
        float(v.replace(",", ""))
        return True
    except ValueError:
        return False


def profile(path):
    rows = list(csv.DictReader(open(path, encoding="utf-8-sig")))
    cols = list(rows[0].keys()) if rows else []
    cso = {"STATISTIC", "UNIT", "VALUE"} <= set(cols)
    fields = []
    skip = set()
    for i, c in enumerate(cols):
        if c in skip:
            continue
        vals = [r[c] for r in rows]
        uniq = list(dict.fromkeys(vals))
        blanks = sum(1 for v in vals if v == "")
        f = {"name": c}
        label_col = None
        # CSO: a code column is followed by its label column
        if cso and i + 1 < len(cols) and c not in ("UNIT", "VALUE"):
            nxt = cols[i + 1]
            if c == "STATISTIC" or c.startswith("TLIST") or c.startswith("C0") or nxt.endswith("Label"):
                label_col = nxt
        if label_col:
            skip.add(label_col)
            f["name"] = label_col
            f["code_column"] = c
            uniq = list(dict.fromkeys(r[label_col] for r in rows))
            if c == "STATISTIC":
                f["role"] = "statistic"
            elif c.startswith("TLIST"):
                f["role"] = "time"
                f["frequency"] = {"A1": "annual", "Q1": "quarterly", "M1": "monthly"}.get(c[6:-1], c[6:-1])
            else:
                f["role"] = "dimension"
                f["dimension_id"] = c  # shared ids (e.g. C03789V04537 = local authority) join tables
        elif cso and c == "VALUE":
            f["role"] = "measure"
        elif cso and c == "UNIT":
            f["role"] = "unit"
        else:
            nums = [v for v in uniq if v != ""]
            f["role"] = "measure" if nums and all(is_number(v) for v in nums) and len(nums) > 20 else "dimension"
        f["distinct"] = len(uniq)
        if blanks:
            f["blanks"] = blanks
        if f["role"] == "measure":
            nums = [float(v.replace(",", "")) for v in vals if v != "" and is_number(v)]
            if nums:
                f["min"], f["max"] = min(nums), max(nums)
        elif f["role"] == "time":
            f["first"], f["last"] = uniq[0], uniq[-1]
            if len(uniq) <= MAX_CATEGORIES:
                f["categories"] = uniq
        elif len(uniq) <= MAX_CATEGORIES:
            f["categories"] = uniq
        else:
            f["first"], f["last"] = uniq[0], uniq[-1]
        fields.append(f)
    measures = []
    if cso:
        stat_col = next((x for x in cols if x.lower() == "statistic label"), "STATISTIC")
        by = {}
        for r in rows:
            m = by.setdefault(r[stat_col], {"statistic": r[stat_col], "units": set(), "nums": [], "blanks": 0})
            m["units"].add(r["UNIT"])
            if r["VALUE"] == "":
                m["blanks"] += 1
            elif is_number(r["VALUE"]):
                m["nums"].append(float(r["VALUE"].replace(",", "")))
        for m in by.values():
            e = {"statistic": m["statistic"], "unit": ", ".join(sorted(m["units"]))}
            if m["nums"]:
                e["min"], e["max"] = min(m["nums"]), max(m["nums"])
            if m["blanks"]:
                e["blanks"] = m["blanks"]
            measures.append(e)
    return rows, fields, measures


def fmt_num(x):
    return f"{int(x):,}" if float(x).is_integer() else f"{x:,}"


def describe(f):
    if f["role"] == "measure":
        s = f"numeric, {fmt_num(f['min'])}–{fmt_num(f['max'])}" if "min" in f else "numeric"
    elif f["role"] == "time":
        s = f"{f['first']} … {f['last']} ({f['distinct']}, {f.get('frequency', '')})"
    elif "categories" in f and f["distinct"] <= 12:
        s = ", ".join(f["categories"])
    elif "categories" in f:
        s = f"{f['distinct']} values: {', '.join(f['categories'][:4])} … {f['categories'][-1]}"
    else:
        s = f"{f['distinct']} values: {f['first']} … {f['last']}"
    if f.get("blanks"):
        s += f"; {f['blanks']} blank"
    return s.replace("|", "/")


def org_section(ds_dir, snap, rows, fields, measures, meta):
    title = meta.get("title", "")
    out = [f"** {ds_dir.name} — {title} ({len(rows):,} rows, snapshot {snap.stem})",
           "| Field | Role | Contents |", "|-------+------+----------|"]
    for f in fields:
        name = f"={f['name']}=" + (f" (=" + f["code_column"] + "=)" if f.get("code_column", "").startswith("C0") else "")
        out.append(f"| {name} | {f['role']} | {describe(f)} |")
    if len(measures) > 1:
        out += ["", "| Statistic (in VALUE) | Unit | Range |", "|-------+------+-------|"]
        for m in measures:
            rng = f"{fmt_num(m['min'])}–{fmt_num(m['max'])}" if "min" in m else ""
            if m.get("blanks"):
                rng += f"; {m['blanks']} blank"
            out.append(f"| {m['statistic'].replace('|', '/')} | {m['unit']} | {rng} |")
    return "\n".join(out)


for arg in sys.argv[1:]:
    snap = Path(arg).resolve()
    ds_dir = snap.parent
    src = ds_dir / "source.json"
    meta = json.loads(src.read_text()) if src.exists() else {}
    rows, fields, measures = profile(snap)
    meta["fields"] = fields
    if measures:
        meta["measures"] = measures
    meta["fields_from"] = snap.name
    src.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    print(org_section(ds_dir, snap, rows, fields, measures, meta))
    print()
