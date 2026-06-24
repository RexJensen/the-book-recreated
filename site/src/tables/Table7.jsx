import { useEffect, useMemo, useState } from 'react'
import { loadEventStates } from '../data/eventStates.js'
import { computeREMatrix } from '../components/reMatrix.js'
import {
  BOOK_EVENT_ORDER,
  computeTransitionEventRows,
  NOT_IN_BOOK,
  signed,
} from './eventTransitions.js'

const COLS = [
  { key: 'label', label: 'Event', cls: 'evt', get: (r) => r.label, dir: 'asc' },
  { key: 'count', label: 'N', cls: 'num', get: (r) => r.count, dir: 'desc' },
  { key: 'runValue', label: 'Run Value', cls: 'num delta', get: (r) => r.runValue, dir: 'desc' },
  { key: 'empirical', label: 'Original', cls: 'num delta', get: (r) => r.empirical, dir: 'desc' },
]

export default function Table7({ sel }) {
  const [stateData, setStateData] = useState(null)
  const [showExtra, setShowExtra] = useState(false)
  const [sort, setSort] = useState({ key: 'runValue', dir: 'desc' })

  useEffect(() => {
    let live = true
    loadEventStates().then((d) => live && setStateData(d))
    return () => {
      live = false
    }
  }, [])

  const labels = useMemo(
    () => (stateData ? Object.fromEntries(stateData.meta.categories) : {}),
    [stateData],
  )

  const rows = useMemo(() => {
    if (!stateData) return null
    const { matrix } = computeREMatrix(sel)
    return computeTransitionEventRows(stateData, sel, matrix, labels)
  }, [stateData, labels, sel])

  const sorted = useMemo(() => {
    if (!rows) return []
    const col = COLS.find((c) => c.key === sort.key)
    const base = showExtra ? rows : rows.filter((r) => !r.extra && BOOK_EVENT_ORDER.includes(r.cat))
    return [...base].sort((a, b) => {
      const av = col.get(a)
      const bv = col.get(b)
      const aMissing = av == null
      const bMissing = bv == null
      if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [rows, sort, showExtra])

  const totalN = sorted.reduce((s, r) => s + r.count, 0)

  const clickSort = (col) =>
    setSort((prev) =>
      prev.key === col.key
        ? { key: col.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key: col.key, dir: col.dir },
    )
  const arrow = (col) => (sort.key === col.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '')

  return (
    <>
      <header className="table-head">
        <h1>Run Values By Event</h1>
        <p className="subtitle">
          {sel.seasonLabel} &nbsp;&middot;&nbsp; {sel.teamLabel}
        </p>
        <p className="credit">
          Table&nbsp;7 from Tom Tango's <em>The Book</em>. This uses the transition method from
          Table&nbsp;6 for every event type, weighting each event's observed start-to-end states:
          runs scored on the play plus ending run expectancy, minus starting run expectancy.
        </p>
      </header>

      <label className="toggle">
        <input type="checkbox" checked={showExtra} onChange={(e) => setShowExtra(e.target.checked)} />
        Show events not in the book (fielder's choice, foul error, other)
      </label>

      {rows == null ? (
        <div className="empty">Loading event data…</div>
      ) : totalN > 0 ? (
        <>
          <table className="ev t7">
            <thead>
              <tr>
                <th className="evt sortable" onClick={() => clickSort(COLS[0])}>
                  Event{arrow(COLS[0])}
                </th>
                <th className="code">code</th>
                {COLS.slice(1).map((c) => (
                  <th key={c.key} className={`${c.cls} sortable`} onClick={() => clickSort(c)}>
                    {c.label}
                    {arrow(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.cat} className={r.extra || !BOOK_EVENT_ORDER.includes(r.cat) ? 'extra' : ''}>
                  <td className="evt">
                    {r.label}
                    {NOT_IN_BOOK.has(r.cat) && <span className="tag">not in book</span>}
                  </td>
                  <td className="code">{r.cat}</td>
                  <td className="num">{r.count.toLocaleString()}</td>
                  <td className={`num delta ${r.runValue == null ? '' : r.runValue >= 0 ? 'pos' : 'neg'}`}>
                    {signed(r.runValue)}
                  </td>
                  <td className={`num delta ${r.empirical == null ? '' : r.empirical >= 0 ? 'pos' : 'neg'}`}>
                    {signed(r.empirical)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            {totalN.toLocaleString()} events. <strong>Run Value</strong> is the weighted transition
            value. <strong>Original</strong> is the runs-to-end-of-inning value from Tables&nbsp;4/5.
            Everything recomputes for the seasons, league and teams you pick.
          </p>
        </>
      ) : (
        <div className="empty">Select at least one team to compute the table.</div>
      )}

      <details className="method">
        <summary>How this is calculated</summary>
        <p>
          For each event occurrence, the site records its starting base/out state, ending base/out
          state, and runs scored on the play. The ending value is runs scored plus the Table&nbsp;1
          run expectancy of the post-play state; plays that make the third out have no remaining run
          expectancy. Table&nbsp;7 averages those ending values by event, then subtracts the event's
          weighted starting run expectancy.
        </p>
        <p className="src">Source: {stateData ? stateData.meta.source : ''}.</p>
      </details>
    </>
  )
}
