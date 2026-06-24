import { useEffect, useMemo, useState } from 'react'
import { loadEventStates } from '../data/eventStates.js'
import { computeREMatrix } from '../components/reMatrix.js'
import { matchesSelection } from '../components/selection.js'

const NOT_IN_BOOK = new Set(['FC', 'FLE', 'OTHER'])

// columns that can be sorted; `get` pulls the sort value from a row
const COLS = [
  { key: 'label', label: 'Event', cls: 'evt', get: (r) => r.label, dir: 'asc' },
  { key: 'count', label: 'N', cls: 'num', get: (r) => r.count, dir: 'desc' },
  { key: 'sumRuns', label: 'Runs to End of Inning', cls: 'num', get: (r) => r.sumRuns, dir: 'desc' },
  { key: 'avg', label: 'Average Runs', cls: 'num', get: (r) => r.avg, dir: 'desc' },
  { key: 'startRE', label: 'Starting RE', cls: 'num start', get: (r) => r.startRE, dir: 'desc' },
  { key: 'runValue', label: 'Run Value', cls: 'num delta', get: (r) => r.runValue, dir: 'desc' },
]

export default function Table2to4({ sel }) {
  const [showExtra, setShowExtra] = useState(false)
  const [sort, setSort] = useState({ key: 'runValue', dir: 'desc' })
  const [stateData, setStateData] = useState(null)

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
    const re = (k) => matrix[k]?.re ?? 0

    const acc = {}
    for (const g of stateData.groups) {
      if (!matchesSelection(g, sel)) continue
      for (const cat in g.events) {
        const e = g.events[cat]
        if (!acc[cat]) acc[cat] = { count: 0, sumRuns: 0, startWeighted: 0 }
        acc[cat].count += e.count
        acc[cat].sumRuns += e.sumRuns
        for (const sk in e.states) acc[cat].startWeighted += e.states[sk][0] * re(sk)
      }
    }
    return Object.entries(acc)
      .map(([cat, v]) => {
        const avg = v.count ? v.sumRuns / v.count : 0
        const startRE = v.count ? v.startWeighted / v.count : 0
        return {
          cat,
          label: labels[cat] || cat,
          count: v.count,
          sumRuns: v.sumRuns,
          avg,
          startRE,
          runValue: avg - startRE,
          extra: NOT_IN_BOOK.has(cat),
        }
      })
      .filter((r) => r.count > 0)
  }, [stateData, labels, sel])

  const sorted = useMemo(() => {
    if (!rows) return []
    const col = COLS.find((c) => c.key === sort.key)
    const base = showExtra ? rows : rows.filter((r) => !r.extra)
    const out = [...base].sort((a, b) => {
      const av = col.get(a)
      const bv = col.get(b)
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return out
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
        <h1>Runs to End of Inning &amp; Run Value, by Event</h1>
        <p className="subtitle">
          {sel.seasonLabel} &nbsp;&middot;&nbsp; {sel.teamLabel}
        </p>
        <p className="credit">
          Tables&nbsp;2, 3 &amp; 4 from Tom Tango's <em>The Book</em>, combined. Each event's average
          runs to the end of the inning (<strong>Table&nbsp;2</strong>), the run expectancy of the
          situation it started in (<strong>Table&nbsp;3</strong>), and the difference between them
          &mdash; the event's <strong>run value</strong> (<strong>Table&nbsp;4</strong>). Click any
          column to sort.
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
          <table className="ev t3">
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
                <tr key={r.cat} className={r.extra ? 'extra' : ''}>
                  <td className="evt">
                    {r.label}
                    {r.extra && <span className="tag">not in book</span>}
                  </td>
                  <td className="code">{r.cat}</td>
                  <td className="num">{r.count.toLocaleString()}</td>
                  <td className="num">{Math.round(r.sumRuns).toLocaleString()}</td>
                  <td className="num">{r.avg.toFixed(3)}</td>
                  <td className="num start">{r.startRE.toFixed(3)}</td>
                  <td className={`num delta ${r.runValue >= 0 ? 'pos' : 'neg'}`}>
                    {r.runValue >= 0 ? '+' : '−'}
                    {Math.abs(r.runValue).toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            {totalN.toLocaleString()} events. <strong>Run Value</strong> = Average − Starting RE: the
            average change in run expectancy an event produces. It's positive for hits and walks and
            negative for outs &mdash; and notably negative for the sacrifice bunt, which on average
            lowers run expectancy. Everything recomputes for the seasons, league and teams you pick.
          </p>
        </>
      ) : (
        <div className="empty">Select at least one team to compute the table.</div>
      )}

      <details className="method">
        <summary>How this is calculated</summary>
        <p>
          <strong>Average runs</strong> is the mean runs scored from each event to the end of the
          inning, over every occurrence (all events, not just plate appearances; complete 3-out
          innings only, excluding home halves of the ninth or later). <strong>Starting RE</strong>{' '}
          looks up the run expectancy of each event's starting base/out state in the Table&nbsp;1
          matrix and averages it. <strong>Run
          Value</strong> is their difference.
        </p>
        <p>
          Because the site stores each event's distribution of starting states per (season, team),
          all three numbers are recomputed exactly for whatever selection you make, using the
          matching run-expectancy matrix.
        </p>
        <p className="src">Source: {stateData ? stateData.meta.source : ''}.</p>
      </details>
    </>
  )
}
