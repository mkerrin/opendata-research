import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const ROOT = '/home/michael/src/opendatamcp'
const TOPIC = `${ROOT}/data/housing-supply`

const SOURCE = JSON.stringify({
  source: 'cso',
  id: 'HSM14',
  title: 'Housing completions',
  publisher: 'Central Statistics Office',
  landing_page: 'https://data.cso.ie/table/HSM14',
  units: 'Number',
  snapshots: [
    { file: '2026-10-18.csv', fetched_at: '2026-10-18T10:00:00Z', upstream_updated: '2026-10-01', latest_period: '2026M09', rows: 1234 },
  ],
  fields: [
    { name: 'VALUE', role: 'measure', distinct: 900, min: 0, max: 4567 },
    { name: 'Month', role: 'time', frequency: 'monthly', distinct: 120, first: '2016 January', last: '2026 September' },
    { name: 'County', role: 'dimension', distinct: 26, categories: ['Carlow', 'Cavan', 'Clare', 'Cork', 'Donegal'] },
  ],
  measures: [{ statistic: 'Completions', unit: 'Number', min: 0, max: 4567 }],
})

const PANE = {
  plugin: 'research-mod',
  component: 'Pane',
  requestId: 'research-datasets',
  surface: 'terminal',
  props: {
    title: 'Datasets',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const engine = (on: Parameters<TestBody>[1]) => {
  on('ui.status', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('tool.call', () => ({ result: {} }))
  on('session.cwd', () => ({ value: ROOT }))
  on('fs.exists', (_, e) => ({
    value: [TOPIC, `${TOPIC}/cso-HSM14/source.json`].includes(e.path),
  }))
  on('fs.list', () => ({
    value: [
      { name: 'cso-HSM14', kind: 'dir', size: 0, mtimeMs: 0, isLink: false },
      { name: 'cso-NOSRC', kind: 'dir', size: 0, mtimeMs: 0, isLink: false },
      { name: 'notes.org', kind: 'file', size: 10, mtimeMs: 0, isLink: false },
    ],
  }))
  on('fs.read', () => ({ value: SOURCE }))
}

test('a dataset the session used shows its metadata and fields', async ($, on) => {
  engine(on)

  // @ts-ignore TS2589: the tool-call union is too deep for tsc here; runs fine
  await $.tool.call({ tool: 'Read', file_path: `${TOPIC}/cso-HSM14/2026-10-18.csv` })

  const ui = await $.ui.mount(PANE)

  expect((await ui.find({ type: 'Text', text: /1 dataset · 1 used/ }))).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: /^Housing supply$/ }))).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: /data to 2026M09 · updated 2026-10-01/ }))).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: /1,234 rows/ }))).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: /Carlow, Cavan, Clare, Cork, \+22/ }))).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: /2016 January – 2026 September/ }))).toBeTruthy()
  await ui.unmount()
})

test('an unused dataset starts closed and opens on press', async ($, on) => {
  engine(on)

  await $.tool.call({ tool: 'Read', file_path: `${TOPIC}/notes.org` })

  const ui = await $.ui.mount(PANE)

  expect(await ui.find({ type: 'Text', text: /0 used/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /1,234 rows/ })).toBeFalsy()

  await ui.press({ key: 'toggle-cso-HSM14' })
  expect(await ui.find({ type: 'Text', text: /1,234 rows/ })).toBeTruthy()
  await ui.unmount()
})

test('collapse all closes every dataset, expand all opens them', async ($, on) => {
  engine(on)

  // @ts-ignore TS2589: the tool-call union is too deep for tsc here; runs fine
  await $.tool.call({ tool: 'Read', file_path: `${TOPIC}/cso-HSM14/2026-10-18.csv` })

  const ui = await $.ui.mount(PANE)

  expect(await ui.find({ type: 'Text', text: /1,234 rows/ })).toBeTruthy()
  await ui.press({ key: 'collapse-all' })
  expect(await ui.find({ type: 'Text', text: /1,234 rows/ })).toBeFalsy()
  await ui.press({ key: 'expand-all' })
  expect(await ui.find({ type: 'Text', text: /1,234 rows/ })).toBeTruthy()
  await ui.unmount()
})
