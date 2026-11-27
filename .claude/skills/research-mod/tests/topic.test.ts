import { expect, test } from 'claude-code/testing'

const ROOT = '/home/michael/src/opendatamcp'

test('a path under data/<topic>/ names the topic', async ($, on) => {
  const shown: (string | undefined)[] = []
  on('ui.status', (_, e) => {
    shown.push(e.text)
    return { value: undefined }
  })
  on('tool.call', () => ({ result: {} }))
  on('ui.open', () => ({ value: { isPlaced: true } }))

  await $.tool.call({ tool: 'Read', file_path: `${ROOT}/data/carbon-emissions/notes.org` })
  await $.tool.call({ tool: 'Bash', command: 'python3 -I x.py data/housing-supply/cso-NDQ06/2026-10-18.csv' })
  await $.tool.call({ tool: 'Bash', command: 'python3 -I x.py data/housing-supply/cso-HSM14/2026-10-18.csv' })

  expect(shown).toEqual(['Researching: carbon-emissions', 'Researching: housing-supply'])
})

test('flat data/ files and nested data/ folders are ignored', async ($, on) => {
  const shown: (string | undefined)[] = []
  on('ui.status', (_, e) => {
    shown.push(e.text)
    return { value: undefined }
  })
  on('tool.call', () => ({ result: {} }))
  on('ui.open', () => ({ value: { isPlaced: true } }))

  await $.tool.call({ tool: 'Read', file_path: `${ROOT}/data/plot_sei03.py` })
  await $.tool.call({ tool: 'Read', file_path: `${ROOT}/data-gov-ie-mcp/data/old/x.csv` })

  expect(shown).toEqual([])
})
