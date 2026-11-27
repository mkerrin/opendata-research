import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type {
  Dataset,
  FieldSummary,
  MeasureSummary,
  Topic,
  TopicDatasets,
} from '../types'

const PANE = 'research-datasets'
const PANE_TITLE = 'Datasets'

const topic = atom({ plugin: 'research-mod', key: 'topic' } as const, null)
// Change a tag when that value's fields change: it declines what an earlier
// version stored, which outlives a reload.
const datasets = atom(
  { plugin: 'research-mod', key: 'datasets' } as const,
  { topic: null, list: [] },
  { shape: 'datasets-1' },
)
const used = atom({ plugin: 'research-mod', key: 'used' } as const, {}, {
  shape: 'used-1',
})
const toggled = atom({ plugin: 'research-mod', key: 'toggled' } as const, [], {
  shape: 'toggled-1',
})

// data/<topic>/... at the workspace root; skips flat files in data/ and
// nested data/ folders such as data-gov-ie-mcp/data/. The optional second
// segment is the dataset folder (cso-HSM14/, dgi-<name>/, ...).
const TOPIC_PATH =
  /(?:^|[\s"'=]|opendatamcp\/)data\/([a-z0-9][a-z0-9-]*)\/(?:([A-Za-z0-9][\w.-]*)\/)?/g

const ARG_KEYS = ['file_path', 'path', 'command', 'notebook_path']

const MAX_CATEGORIES = 4
const MAX_TEXT = 240

const label = (name: Topic) =>
  name === null ? undefined : `Researching: ${name}`

type Found = { topic: string; folders: string[] }

/** The first topic the call names, and every dataset folder under it. */
export const findTopic = (args: Record<string, unknown>): Found | null => {
  for (const key of ARG_KEYS) {
    const value = args[key]

    if (typeof value !== 'string') {
      continue
    }

    let found: Found | null = null

    for (const match of value.matchAll(TOPIC_PATH)) {
      const name = match[1]

      if (name === undefined) {
        continue
      }

      found ??= { topic: name, folders: [] }

      if (name === found.topic && match[2] !== undefined) {
        found.folders.push(match[2])
      }
    }

    if (found !== null) {
      return found
    }
  }

  return null
}

// ---------------------------------------------------------------- reading

const str = (value: unknown) =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined

const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const clip = (text: string | undefined, max = MAX_TEXT) =>
  text === undefined || text.length <= max ? text : `${text.slice(0, max - 1)}…`

const fmt = (value: number | undefined) =>
  value === undefined ? '?' : value.toLocaleString('en-IE')

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const describeField = (raw: unknown): FieldSummary => {
  const f = asRecord(raw)
  const role = str(f.role) ?? 'field'
  const distinct = num(f.distinct)
  const parts: string[] = []

  if (role === 'time') {
    const frequency = str(f.frequency)
    const first = str(f.first)
    const last = str(f.last)

    if (frequency !== undefined) parts.push(frequency)
    if (first !== undefined || last !== undefined) {
      parts.push(`${first ?? '?'} – ${last ?? '?'}`)
    }
    if (distinct !== undefined) parts.push(`${fmt(distinct)} periods`)
  } else if (num(f.min) !== undefined || num(f.max) !== undefined) {
    parts.push(`${fmt(num(f.min))} – ${fmt(num(f.max))}`)
    if (distinct !== undefined) parts.push(`${fmt(distinct)} distinct`)
  } else {
    const categories = asList(f.categories).filter(
      (c): c is string => typeof c === 'string',
    )

    if (categories.length > 0) {
      const shown = categories.slice(0, MAX_CATEGORIES).map(c => clip(c, 40))
      const more = (distinct ?? categories.length) - shown.length
      parts.push(`${fmt(distinct ?? categories.length)}: ${shown.join(', ')}${more > 0 ? `, +${fmt(more)}` : ''}`)
    } else if (distinct !== undefined) {
      parts.push(`${fmt(distinct)} distinct`)
    }
  }

  const blanks = num(f.blanks)

  if (blanks !== undefined && blanks > 0) parts.push(`${fmt(blanks)} blank`)

  return { name: str(f.name) ?? '?', role, detail: parts.join(' · ') }
}

const describeMeasure = (raw: unknown): MeasureSummary => {
  const m = asRecord(raw)

  return {
    statistic: str(m.statistic) ?? '?',
    unit: str(m.unit) ?? '',
    range: `${fmt(num(m.min))} – ${fmt(num(m.max))}`,
  }
}

/** One source.json as the pane shows it. */
export const summarise = (folder: string, text: string): Dataset => {
  const d = asRecord(JSON.parse(text))
  const snapshots = asList(d.snapshots).map(asRecord)
  const last = snapshots.at(-1)

  return {
    folder,
    source: str(d.source) ?? folder.split('-')[0] ?? '?',
    id: str(d.id) ?? folder,
    title: str(d.title) ?? folder,
    publisher: str(d.publisher),
    landingPage: str(d.landing_page),
    units: str(d.units),
    licence: clip(str(d.licence)),
    notes: clip(str(d.notes) ?? str(d.download_note)),
    filter: clip(str(d.filter) ?? str(d.slice)),
    snapshotCount: snapshots.length,
    latest:
      last === undefined
        ? undefined
        : {
            file: str(last.file) ?? str(last.folder),
            fetchedAt: str(last.fetched_at)?.slice(0, 10),
            upstreamUpdated: str(last.upstream_updated),
            latestPeriod: str(last.latest_period),
            rows: num(last.rows),
          },
    fields: asList(d.fields).map(describeField),
    measures: asList(d.measures).map(describeMeasure),
  }
}

/** data/<name>/ under the session's folder or the nearest folder above it. */
const topicDir = async ($: EngineInterface, name: string) => {
  let dir = (await $.session.cwd()).replace(/\/+$/, '')

  for (let depth = 0; depth < 8 && dir !== ''; depth++) {
    const candidate = `${dir}/data/${name}`

    if (await $.fs.exists(candidate)) {
      return candidate
    }

    dir = dir.slice(0, dir.lastIndexOf('/'))
  }

  return null
}

const loadDatasets = async (
  $: EngineInterface,
  name: string,
): Promise<TopicDatasets> => {
  const dir = await topicDir($, name)

  if (dir === null) {
    return { topic: name, list: [] }
  }

  const entries = await $.fs.list(dir)
  const folders = entries
    .filter(entry => entry.kind === 'dir' && !entry.name.startsWith('dashboard-'))
    .map(entry => entry.name)
    .sort()

  const list = await Promise.all(
    folders.map(async folder => {
      const path = `${dir}/${folder}/source.json`

      if (!(await $.fs.exists(path))) {
        return null
      }

      try {
        return summarise(folder, await $.fs.read(path))
      } catch (error) {
        return {
          folder,
          source: '?',
          id: folder,
          title: folder,
          snapshotCount: 0,
          fields: [],
          measures: [],
          error: `source.json unreadable: ${String(error)}`,
        } satisfies Dataset
      }
    }),
  )

  return { topic: name, list: list.filter(d => d !== null) }
}

const refresh = async ($: EngineInterface, name: string) => {
  const loaded = await loadDatasets($, name).catch(() => ({
    topic: name,
    list: [],
  }))

  await update($, datasets, () => loaded)
}

// ---------------------------------------------------------------- the pane

const SOURCE_NAMES: Record<string, string> = {
  cso: 'CSO',
  dgi: 'data.gov.ie',
  eurostat: 'Eurostat',
}

/** housing-supply -> Housing supply */
const topicTitle = (name: string) => {
  const words = name.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

const ROLE_ORDER = ['statistic', 'time', 'dimension', 'unit', 'measure']

const byRole = (a: FieldSummary, b: FieldSummary) => {
  const rank = (f: FieldSummary) => {
    const i = ROLE_ORDER.indexOf(f.role)
    return i === -1 ? ROLE_ORDER.length : i
  }
  return rank(a) - rank(b)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const current = await read($, topic)
    $.ui.status(label(current))
    await $.command.register({
      name: 'datasets',
      description: 'Show the datasets of the current research topic in a side pane',
    })

    if (current !== null) {
      await refresh($, current)
    }

    return next(e)
  })

  on('command.run', { command: 'datasets' }, async $ => {
    const current = await read($, topic)

    if (current !== null) {
      await refresh($, current)
    }

    await $.ui.open({ id: PANE, title: PANE_TITLE, backgroundColor: 'transparent' })

    return { text: current === null ? 'Datasets pane opened (no topic yet).' : `Datasets pane opened for ${current}.` }
  })

  on('tool.call', async ($, e, next) => {
    const found = findTopic(e as unknown as Record<string, unknown>)

    if (found === null) {
      return next(e)
    }

    const isNew = found.topic !== (await read($, topic))

    if (isNew) {
      await update($, topic, () => found.topic)
      $.ui.status(label(found.topic))
    }

    if (found.folders.length > 0) {
      await update($, used, map => {
        const had = map[found.topic] ?? []
        const added = found.folders.filter(f => !had.includes(f))
        return added.length === 0 ? map : { ...map, [found.topic]: [...had, ...added] }
      })
    }

    if (isNew) {
      await refresh($, found.topic)
      void $.ui.open({ id: PANE, title: PANE_TITLE, backgroundColor: 'transparent' })
    }

    // The call may have written a snapshot or a source.json: read again after.
    const result = await next(e)
    await refresh($, found.topic)

    return result
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Link } = $.ui.resolve(e)
    const current = await read($, topic)
    const loaded = await read($, datasets)
    const usedHere = current === null ? [] : ((await read($, used))[current] ?? [])
    const flipped = await read($, toggled)

    if (current === null) {
      return (
        <Box flexDirection="column">
          <Text dimColor>No research topic yet.</Text>
          <Text dimColor>Open or run anything under data/&lt;topic&gt;/ and its datasets show here.</Text>
        </Box>
      )
    }

    const list = loaded.topic === current ? loaded.list : []
    const isUsed = (d: Dataset) => usedHere.includes(d.folder)
    const ordered = [...list.filter(isUsed), ...list.filter(d => !isUsed(d))]
    const isOpen = (d: Dataset) =>
      isUsed(d) !== flipped.includes(`${current}/${d.folder}`)
    const toggle = (d: Dataset) => () => {
      const id = `${current}/${d.folder}`
      void update($, toggled, all =>
        all.includes(id) ? all.filter(x => x !== id) : [...all, id],
      )
    }

    // Every dataset of this topic open or closed: flip those whose default
    // (open when used this session) differs, keep other topics' flips.
    const setAll = (open: boolean) => () => {
      const prefix = `${current}/`
      const flips = list
        .filter(d => isUsed(d) !== open)
        .map(d => `${prefix}${d.folder}`)
      void update($, toggled, all => [
        ...all.filter(x => !x.startsWith(prefix)),
        ...flips,
      ])
    }
    const anyOpen = list.some(isOpen)
    const anyClosed = list.some(d => !isOpen(d))

    return (
      <Box flexDirection="column">
        <Box flexDirection="column" borderStyle="round" borderColor="claude" paddingX={1}>
          <Text dimColor size="caption">TOPIC</Text>
          <Text bold color="claude" size="heading" wrap="wrap">{topicTitle(current)}</Text>
          <Text dimColor wrap="wrap">
            data/{current}/ · {list.length} dataset{list.length === 1 ? '' : 's'} · {list.filter(isUsed).length} used this session
          </Text>
        </Box>
        {list.length > 0 && (
          <Box flexDirection="row" gap={2}>
            <Button key="collapse-all" plain hotkey="c" dimColor={!anyOpen} onPress={setAll(false)}>
              Collapse all
            </Button>
            <Button key="expand-all" plain hotkey="e" dimColor={!anyClosed} onPress={setAll(true)}>
              Expand all
            </Button>
          </Box>
        )}
        {list.length === 0 && (
          <Text dimColor>No source.json found under data/{current}/.</Text>
        )}
        {ordered.map(d => (
          <Box key={d.folder} flexDirection="column" marginTop={1}>
            <Button key={`toggle-${d.folder}`} plain dimColor={!isUsed(d)} onPress={toggle(d)}>
              {isOpen(d) ? '▾' : '▸'} {isUsed(d) ? '● ' : ''}{d.folder}
            </Button>
            <Text bold={isUsed(d)} wrap="wrap">{d.title}</Text>
            <Text dimColor wrap="wrap">
              {[
                SOURCE_NAMES[d.source] ?? d.source,
                d.latest?.latestPeriod && `data to ${d.latest.latestPeriod}`,
                d.latest?.upstreamUpdated && `updated ${d.latest.upstreamUpdated}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {d.error !== undefined && <Text color="error">{d.error}</Text>}
            {isOpen(d) && (
              <Box flexDirection="column" paddingLeft={2}>
                {d.latest !== undefined && (
                  <Text dimColor wrap="wrap">
                    snapshot {d.latest.file ?? '?'} · {fmt(d.latest.rows)} rows · fetched {d.latest.fetchedAt ?? '?'}
                    {d.snapshotCount > 1 ? ` · ${d.snapshotCount} snapshots` : ''}
                  </Text>
                )}
                {d.publisher !== undefined && <Text dimColor wrap="wrap">publisher: {d.publisher}</Text>}
                {d.units !== undefined && <Text dimColor wrap="wrap">units: {d.units}</Text>}
                {d.filter !== undefined && <Text dimColor wrap="wrap">slice: {d.filter}</Text>}
                {d.licence !== undefined && <Text dimColor wrap="wrap">licence: {d.licence}</Text>}
                {d.notes !== undefined && <Text color="warning" wrap="wrap">note: {d.notes}</Text>}
                {d.fields.length > 0 && <Text bold>Fields</Text>}
                {[...d.fields].sort(byRole).map(f => (
                  <Text wrap="wrap">
                    {f.name} <Text dimColor>({f.role}){f.detail === '' ? '' : ` ${f.detail}`}</Text>
                  </Text>
                ))}
                {d.measures.length > 0 && <Text bold>Measures</Text>}
                {d.measures.map(m => (
                  <Text wrap="wrap">
                    {m.statistic} <Text dimColor>{m.unit === '' ? '' : `${m.unit} · `}{m.range}</Text>
                  </Text>
                ))}
                {d.landingPage !== undefined && <Link href={d.landingPage} label={d.landingPage} />}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    )
  })
}
