export type Topic = string | null

/** One field of a snapshot, as describe_fields.py saved it, cut to one line. */
export type FieldSummary = { name: string; role: string; detail: string }

export type MeasureSummary = { statistic: string; unit: string; range: string }

/** What the pane shows of one data/<topic>/<folder>/source.json. */
export type Dataset = {
  folder: string
  source: string
  id: string
  title: string
  publisher?: string
  landingPage?: string
  units?: string
  licence?: string
  notes?: string
  filter?: string
  snapshotCount: number
  latest?: {
    file?: string
    fetchedAt?: string
    upstreamUpdated?: string
    latestPeriod?: string
    rows?: number
  }
  fields: FieldSummary[]
  measures: MeasureSummary[]
  /** The source.json could not be read or parsed. */
  error?: string
}

/** The datasets of one topic, read from their source.json files. */
export type TopicDatasets = { topic: Topic; list: Dataset[] }

declare module 'claude-code' {
  interface PluginState {
    'opendata-mod': {
      topic: Topic
      datasets: Shaped<TopicDatasets>
      /** Dataset folders touched this session, per topic. */
      used: Shaped<Record<string, string[]>>
      /** `<topic>/<folder>` whose open/closed state the person flipped. */
      toggled: Shaped<string[]>
    }
  }
}
