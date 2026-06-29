import { useEffect, useMemo, useState } from 'react'
import { matchesSelection } from '../components/selection.js'
import { computeREMatrix } from '../components/reMatrix.js'
import { loadEventStates } from '../data/eventStates.js'
import { loadWinEvents } from '../data/winEvents.js'
import {
  BOOK_EVENT_ORDER,
  computeTransitionEventRows,
  NOT_IN_BOOK,
  signed,
} from './eventTransitions.js'
import { computeWinExpectancyModel } from './winExpectancy.js'

const BOOK_TABLE_11 = {
  HR: { count: 21734, start: 0.514, end: 0.638, win: 0.123, runs: 1.397, runsPerWin: 11.3 },
  '3B': { count: 3732, start: 0.54, end: 0.633, win: 0.093, runs: 1.07, runsPerWin: 11.5 },
  '2B': { count: 35141, start: 0.521, end: 0.587, win: 0.066, runs: 0.776, runsPerWin: 11.7 },
  RBOE: { count: 7616, start: 0.52, end: 0.564, win: 0.044, runs: 0.508, runsPerWin: 11.5 },
  '1B': { count: 114832, start: 0.514, end: 0.556, win: 0.042, runs: 0.475, runsPerWin: 11.3 },
  INT: { count: 60, start: 0.558, end: 0.592, win: 0.034, runs: 0.392, runsPerWin: 11.6 },
  HBP: { count: 6787, start: 0.547, end: 0.577, win: 0.029, runs: 0.352, runsPerWin: 12.0 },
  BK: { count: 649, start: 0.568, end: 0.597, win: 0.028, runs: 0.264, runsPerWin: 9.3 },
  NIBB: { count: 63004, start: 0.525, end: 0.553, win: 0.028, runs: 0.323, runsPerWin: 11.6 },
  PB: { count: 1234, start: 0.548, end: 0.574, win: 0.025, runs: 0.269, runsPerWin: 10.6 },
  WP: { count: 5608, start: 0.564, end: 0.589, win: 0.024, runs: 0.266, runsPerWin: 10.9 },
  SB: { count: 10908, start: 0.583, end: 0.602, win: 0.018, runs: 0.175, runsPerWin: 9.5 },
  IBB: { count: 5143, start: 0.724, end: 0.734, win: 0.01, runs: 0.179, runsPerWin: 17.8 },
  BUNT: { count: 4862, start: 0.537, end: 0.539, win: 0.003, runs: 0.042, runsPerWin: 15.0 },
  DI: { count: 779, start: 0.109, end: 0.112, win: 0.003, runs: 0.12, runsPerWin: 44.5 },
  SAC: { count: 6448, start: 0.638, end: 0.628, win: -0.01, runs: -0.096, runsPerWin: 9.9 },
  PK: { count: 2294, start: 0.607, end: 0.583, win: -0.024, runs: -0.281, runsPerWin: 11.7 },
  OUT: { count: 358019, start: 0.512, end: 0.486, win: -0.026, runs: -0.299, runsPerWin: 11.4 },
  K: { count: 125876, start: 0.506, end: 0.479, win: -0.027, runs: -0.301, runsPerWin: 11.0 },
  CS: { count: 3800, start: 0.608, end: 0.565, win: -0.043, runs: -0.467, runsPerWin: 10.8 },
}

const COLS = [
  { key: 'label', label: 'Event', cls: 'evt', get: (r) => r.label, dir: 'asc' },
  { key: 'count', label: 'N', cls: 'num', get: (r) => r.count, dir: 'desc' },
  { key: 'startWin', label: 'Starting Wins', cls: 'num', get: (r) => r.startWin, dir: 'desc' },
  { key: 'endWin', label: 'Ending Wins', cls: 'num', get: (r) => r.endWin, dir: 'desc' },
  { key: 'winValue', label: 'Wins', cls: 'num delta', get: (r) => r.winValue, dir: 'desc' },
  { key: 'runValue', label: 'Runs', cls: 'num delta', get: (r) => r.runValue, dir: 'desc' },
  { key: 'runsPerWin', label: 'Runs/Win', cls: 'num', get: (r) => r.runsPerWin, dir: 'asc' },
]

const fmt = (value) => (value == null ? '—' : value.toFixed(3))
const fmtRunsPerWin = (value) => (value == null || !Number.isFinite(value) ? '—' : value.toFixed(1))
function parseState(stateText) {
  if (stateText === 'W') return { terminal: true, homeWin: 1 }
  if (stateText === 'L') return { terminal: true, homeWin: 0 }
  if (stateText === 'T') return { terminal: true, homeWin: 0.5 }
  const [inningText, half, diffText, keyText] = stateText.split('|')
  const key = Number(keyText)
  return {
    terminal: false,
    inning: Number(inningText),
    half: half === 'T' ? 'top' : 'bottom',
    diff: Number(diffText),
    base: Math.floor(key / 10),
    outs: key % 10,
  }
}

function homeWinFor(parsed, model) {
  if (parsed.terminal) return parsed.homeWin
  return model.winProbability(parsed)
}

function computeStateWinValues(states, model) {
  const parsed = states.map(parseState)
  const homeWins = parsed.map((state) => homeWinFor(state, model))
  const battingTeamWins = Array.from({ length: states.length }, () => ({ top: null, bottom: null }))

  for (let i = 0; i < states.length; i += 1) {
    const value = homeWins[i]
    battingTeamWins[i].bottom = value
    battingTeamWins[i].top = value == null ? null : 1 - value
  }

  return {
    parsed,
    battingValue: (stateId, battingHalf) => battingTeamWins[stateId]?.[battingHalf] ?? null,
  }
}

function decodeWinRows(winData, sel, labels, model, runRowsByCat) {
  const stateValues = computeStateWinValues(winData.states, model)
  const acc = {}

  for (const group of winData.groups) {
    const [season, team, league, events] = group
    if (!matchesSelection({ season, team, league }, sel)) continue

    for (const [eventId, count, flat] of events) {
      const cat = winData.events[eventId]
      if (!acc[cat]) acc[cat] = { count: 0, startWeighted: 0, endWeighted: 0, transitionCount: 0 }
      const row = acc[cat]
      row.count += count

      let start = 0
      let end = 0
      for (let i = 0; i < flat.length; i += 3) {
        const startDelta = flat[i]
        if (startDelta) end = 0
        start += startDelta
        end += flat[i + 1]
        const transitionCount = flat[i + 2]
        const startState = stateValues.parsed[start]
        if (!startState || startState.terminal) continue
        const battingHalf = startState.half
        const startWin = stateValues.battingValue(start, battingHalf)
        const endWin = stateValues.battingValue(end, battingHalf)
        if (startWin == null || endWin == null) continue
        row.startWeighted += transitionCount * startWin
        row.endWeighted += transitionCount * endWin
        row.transitionCount += transitionCount
      }
    }
  }

  return Object.entries(acc)
    .map(([cat, v]) => {
      const startWin = v.transitionCount ? v.startWeighted / v.transitionCount : null
      const endWin = v.transitionCount ? v.endWeighted / v.transitionCount : null
      const winValue = startWin == null || endWin == null ? null : endWin - startWin
      const runValue = runRowsByCat[cat]?.runValue ?? null
      const runsPerWin =
        runValue == null || winValue == null || Math.abs(winValue) < 0.0005 ? null : runValue / winValue
      const book = BOOK_TABLE_11[cat]
      return {
        cat,
        label: labels[cat] || cat,
        count: v.count,
        startWin,
        endWin,
        winValue,
        runValue,
        runsPerWin,
        book,
        bookDiff: book == null || winValue == null ? null : winValue - book.win,
        countDiff: book == null ? null : v.count - book.count,
        extra: NOT_IN_BOOK.has(cat) || !BOOK_EVENT_ORDER.includes(cat),
      }
    })
    .filter((r) => r.count > 0)
}

export default function Table11({ sel }) {
  const [stateData, setStateData] = useState(null)
  const [winData, setWinData] = useState(null)
  const [showExtra, setShowExtra] = useState(false)
  const [sort, setSort] = useState({ key: 'winValue', dir: 'desc' })

  useEffect(() => {
    let live = true
    Promise.all([loadEventStates(), loadWinEvents()]).then(([states, wins]) => {
      if (live) {
        setStateData(states)
        setWinData(wins)
      }
    })
    return () => {
      live = false
    }
  }, [])

  const labels = useMemo(
    () => (stateData ? Object.fromEntries(stateData.meta.categories) : {}),
    [stateData],
  )

  const rows = useMemo(() => {
    if (!stateData || !winData) return null
    const { matrix } = computeREMatrix(sel)
    const runRows = computeTransitionEventRows(stateData, sel, matrix, labels)
    const runRowsByCat = Object.fromEntries(runRows.map((row) => [row.cat, row]))
    const model = computeWinExpectancyModel(stateData, sel)
    if (!model.totalTransitions) return []
    return decodeWinRows(winData, sel, labels, model, runRowsByCat)
  }, [stateData, winData, labels, sel])

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

  const totalN = sorted.reduce((sum, row) => sum + row.count, 0)
  const loading = rows == null

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
        <h1>Win Values By Event</h1>
        <p className="subtitle">
          {sel.seasonLabel} &nbsp;&middot;&nbsp; {sel.teamLabel}
        </p>
        <p className="credit">
          Table&nbsp;11 from Tom Tango's <em>The Book</em>. Every event is valued by
          the batting team's win probability before and after the play, using the Table&nbsp;10
          win-expectancy model.
        </p>
      </header>

      <label className="toggle">
        <input type="checkbox" checked={showExtra} onChange={(e) => setShowExtra(e.target.checked)} />
        Show events not in the book (fielder's choice, foul error, other)
      </label>

      {loading ? (
        <div className="empty">Loading all-game win transitions…</div>
      ) : totalN > 0 ? (
        <>
          <div className="table-scroll">
            <table className="ev t11">
              <thead>
                <tr>
                  <th className="evt sortable" onClick={() => clickSort(COLS[0])}>
                    Event{arrow(COLS[0])}
                  </th>
                  <th className="code">code</th>
                  {COLS.slice(1).map((col) => (
                    <th key={col.key} className={`${col.cls} sortable`} onClick={() => clickSort(col)}>
                      {col.label}
                      {arrow(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.cat} className={row.extra ? 'extra' : ''}>
                    <td className="evt">
                      {row.label}
                      {NOT_IN_BOOK.has(row.cat) && <span className="tag">not in book</span>}
                    </td>
                    <td className="code">{row.cat}</td>
                    <td className="num">{row.count.toLocaleString()}</td>
                    <td className="num">{fmt(row.startWin)}</td>
                    <td className="num">{fmt(row.endWin)}</td>
                    <td className={`num delta ${row.winValue == null ? '' : row.winValue >= 0 ? 'pos' : 'neg'}`}>
                      {signed(row.winValue)}
                    </td>
                    <td className={`num delta ${row.runValue == null ? '' : row.runValue >= 0 ? 'pos' : 'neg'}`}>
                      {signed(row.runValue)}
                    </td>
                    <td className="num">{fmtRunsPerWin(row.runsPerWin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">
            {totalN.toLocaleString()} events. <strong>Wins</strong> is Ending Wins minus Starting
            Wins. <strong>Runs/Win</strong> divides the Table&nbsp;7 transition run value by the
            win value, so context-heavy events move away from the average conversion rate.
          </p>
        </>
      ) : (
        <div className="empty">Select at least one team to compute the table.</div>
      )}

      <details className="method">
        <summary>How this is calculated</summary>
        <p>
          Table&nbsp;11 uses every event, including walk-offs and partial innings. For each occurrence,
          the site looks up the Table&nbsp;10 win expectancy of the game state before the play and the
          game state after the play. Visitor events use one minus home win expectancy; home events use
          home win expectancy. The difference is averaged by event.
        </p>
        <p className="src">Source: {winData ? winData.meta.source : ''}.</p>
      </details>
    </>
  )
}
