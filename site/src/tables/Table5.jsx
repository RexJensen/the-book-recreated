import { useEffect, useMemo, useState } from 'react'
import { BASE_ORDER, OUTS, computeREMatrix } from '../components/reMatrix.js'
import { matchesSelection } from '../components/selection.js'

const onFirst = (b) => b & 1
const onSecond = (b) => b & 2
const onThird = (b) => b & 4

// Events worth breaking down by base/out state, in a sensible menu order.
// (Bases-empty events like the strikeout still work; the empty-base rows just
// dominate. We keep the full list so any event can be inspected.)
const EVENT_ORDER = ['HR', '3B', '2B', '1B', 'NIBB', 'IBB', 'HBP', 'SB', 'CS', 'K', 'OUT', 'SAC']

export default function Table5({ sel }) {
  const [stateData, setStateData] = useState(null)
  const [event, setEvent] = useState('HR')

  useEffect(() => {
    let live = true
    import('../data/event_states.json').then((m) => live && setStateData(m.default))
    return () => {
      live = false
    }
  }, [])

  const labels = useMemo(
    () => (stateData ? Object.fromEntries(stateData.meta.categories) : {}),
    [stateData],
  )

  // Which events actually occur in the data, ordered for the dropdown.
  const eventChoices = useMemo(() => {
    if (!stateData) return []
    const seen = new Set()
    for (const g of stateData.groups) for (const cat in g.events) seen.add(cat)
    const ordered = EVENT_ORDER.filter((c) => seen.has(c))
    const rest = [...seen].filter((c) => !EVENT_ORDER.includes(c)).sort()
    return [...ordered, ...rest]
  }, [stateData])

  const { rows, totalN, sumRunsTotal } = useMemo(() => {
    if (!stateData) return { rows: null, totalN: 0, sumRunsTotal: 0 }
    const { matrix } = computeREMatrix(sel)

    // accumulate [count, sumRuns] per base/out state for the chosen event
    const acc = {}
    for (const o of OUTS) for (const b of BASE_ORDER) acc[b * 10 + o] = { count: 0, sumRuns: 0 }
    for (const g of stateData.groups) {
      if (!matchesSelection(g, sel)) continue
      const e = g.events[event]
      if (!e) continue
      for (const sk in e.states) {
        const [c, r] = e.states[sk]
        if (!acc[sk]) acc[sk] = { count: 0, sumRuns: 0 }
        acc[sk].count += c
        acc[sk].sumRuns += r
      }
    }

    const rows = []
    let totalN = 0
    let sumRunsTotal = 0
    for (const b of BASE_ORDER) {
      for (const o of OUTS) {
        const k = b * 10 + o
        const { count, sumRuns } = acc[k]
        const avg = count ? sumRuns / count : null
        const startRE = matrix[k]?.re ?? null
        totalN += count
        sumRunsTotal += sumRuns
        rows.push({
          base: b,
          outs: o,
          count,
          sumRuns,
          avg,
          startRE,
          runValue: avg != null && startRE != null ? avg - startRE : null,
        })
      }
    }
    return { rows, totalN, sumRunsTotal }
  }, [stateData, sel, event])

  return (
    <>
      <header className="table-head">
        <h1>Runs to End of Inning, by Base/Out State</h1>
        <p className="subtitle">
          {sel.seasonLabel} &nbsp;&middot;&nbsp; {sel.teamLabel}
        </p>
        <p className="credit">
          Table&nbsp;5 from Tom Tango's <em>The Book</em> &mdash; for a single event type, the runs
          scored to the end of the inning from each of the 24 base/out states, and the run value of
          that event in each situation.
        </p>
      </header>

      <label className="toggle">
        Event:&nbsp;
        <select value={event} onChange={(e) => setEvent(e.target.value)}>
          {eventChoices.map((c) => (
            <option key={c} value={c}>
              {labels[c] || c}
            </option>
          ))}
        </select>
      </label>

      {rows == null ? (
        <div className="empty">Loading event data…</div>
      ) : totalN > 0 ? (
        <>
          <table className="ev t5">
            <thead>
              <tr>
                <th className="b">1B</th>
                <th className="b">2B</th>
                <th className="b">3B</th>
                <th className="num">Outs</th>
                <th className="num">N</th>
                <th className="num">Runs to End of Inning</th>
                <th className="num">Average</th>
                <th className="num start">Starting RE</th>
                <th className="num delta">Run Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.base * 10 + r.outs} className={r.outs === 2 ? 'group-end' : ''}>
                  <td className="b">{onFirst(r.base) ? '1B' : '––'}</td>
                  <td className="b">{onSecond(r.base) ? '2B' : '––'}</td>
                  <td className="b">{onThird(r.base) ? '3B' : '––'}</td>
                  <td className="num">{r.outs}</td>
                  <td className="num">{r.count.toLocaleString()}</td>
                  <td className="num">{Math.round(r.sumRuns).toLocaleString()}</td>
                  <td className="num">{r.avg != null ? r.avg.toFixed(3) : '—'}</td>
                  <td className="num start">{r.startRE != null ? r.startRE.toFixed(3) : '—'}</td>
                  <td
                    className={`num delta ${r.runValue == null ? '' : r.runValue >= 0 ? 'pos' : 'neg'}`}
                  >
                    {r.runValue == null
                      ? '—'
                      : `${r.runValue >= 0 ? '+' : '−'}${Math.abs(r.runValue).toFixed(3)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            {totalN.toLocaleString()} {labels[event] || event} events. <strong>Average</strong> is the
            mean runs to the end of the inning from each starting state; <strong>Starting RE</strong>{' '}
            is that state's run expectancy (Table&nbsp;1); <strong>Run Value</strong> is their
            difference &mdash; the change in run expectancy the event produces in that situation.
            Everything recomputes for the seasons, league and teams you pick.
          </p>
        </>
      ) : (
        <div className="empty">No {labels[event] || event} events for this selection.</div>
      )}

      <details className="method">
        <summary>How this is calculated</summary>
        <p>
          For every occurrence of the chosen event we record the base/out state it started in and the
          runs the batting team went on to score before the inning ended (complete 3-out innings
          only, excluding home halves of the ninth or later). Each row averages those runs over the
          occurrences that started in that state.{' '}
          <strong>Starting RE</strong> comes from the Table&nbsp;1 matrix for the same selection, and{' '}
          <strong>Run Value</strong> is Average − Starting RE.
        </p>
        <p className="src">Source: {stateData ? stateData.meta.source : ''}.</p>
      </details>
    </>
  )
}
