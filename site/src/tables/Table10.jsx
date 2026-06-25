import { useEffect, useMemo, useState } from 'react'
import { loadEventStates } from '../data/eventStates.js'
import { BASE_ORDER, OUTS } from '../components/reMatrix.js'
import {
  BOOK_TABLE_10_ANCHORS,
  SCORE_DIFFS,
  computeWinExpectancyModel,
  isImpossibleBookState,
  makeBookSelection,
  scoreDiffLabel,
} from './winExpectancy.js'

const onFirst = (b) => b & 1
const onSecond = (b) => b & 2
const onThird = (b) => b & 4
const stateKey = (base, outs) => base * 10 + outs

const pct = (value) => (value == null ? '—' : `${(value * 100).toFixed(1)}%`)
const fixed = (value) => (value == null ? '—' : value.toFixed(3))

function stateLabel(base, outs) {
  const bases = [onFirst(base) ? '1B' : null, onSecond(base) ? '2B' : null, onThird(base) ? '3B' : null]
    .filter(Boolean)
    .join(' ')
  return `${bases || 'Empty'}, ${outs} out${outs === 1 ? '' : 's'}`
}

function winColor(value) {
  if (value == null) return undefined
  const t = Math.max(0, Math.min(1, value))
  if (t >= 0.5) {
    const mix = (t - 0.5) / 0.5
    return `rgba(31, 111, 60, ${0.08 + mix * 0.42})`
  }
  const mix = (0.5 - t) / 0.5
  return `rgba(179, 64, 47, ${0.07 + mix * 0.34})`
}

export default function Table10({ sel }) {
  const [stateData, setStateData] = useState(null)
  const [inning, setInning] = useState(9)
  const [half, setHalf] = useState('bottom')
  const [diff, setDiff] = useState(0)
  const [selectedKey, setSelectedKey] = useState(0)

  useEffect(() => {
    let live = true
    loadEventStates().then((d) => live && setStateData(d))
    return () => {
      live = false
    }
  }, [])

  const model = useMemo(() => {
    if (!stateData) return null
    return computeWinExpectancyModel(stateData, sel)
  }, [stateData, sel])

  const bookModel = useMemo(() => {
    if (!stateData) return null
    return computeWinExpectancyModel(stateData, makeBookSelection(stateData))
  }, [stateData])

  const rows = useMemo(() => {
    if (!model) return null
    return BASE_ORDER.flatMap((base) =>
      OUTS.map((outs) => ({
        base,
        outs,
        we: isImpossibleBookState(inning, half, diff)
          ? null
          : model.winProbability({ inning, half, diff, base, outs }),
      })),
    )
  }, [model, inning, half, diff])

  const selectedBase = Math.floor(selectedKey / 10)
  const selectedOuts = selectedKey % 10
  const selectedWE = model?.winProbability({ inning, half, diff, base: selectedBase, outs: selectedOuts })
  const emptyWE = model?.winProbability({ inning, half, diff, base: 0, outs: 0 })
  const selectedStrip = useMemo(() => {
    if (!model) return []
    return SCORE_DIFFS.map((scoreDiff) => ({
      diff: scoreDiff,
      we: isImpossibleBookState(inning, half, scoreDiff)
        ? null
        : model.winProbability({ inning, half, diff: scoreDiff, base: selectedBase, outs: selectedOuts }),
    }))
  }, [model, inning, half, selectedBase, selectedOuts])

  const bookAnchors = useMemo(() => {
    if (!bookModel) return []
    return BOOK_TABLE_10_ANCHORS.map((anchor) => {
      const modelValue = bookModel.winProbability(anchor)
      return {
        ...anchor,
        model: modelValue,
        diff: modelValue == null ? null : modelValue - anchor.book,
      }
    })
  }, [bookModel])

  const meanAbsGap =
    bookAnchors.length && bookAnchors.every((anchor) => anchor.diff != null)
      ? bookAnchors.reduce((sum, anchor) => sum + Math.abs(anchor.diff), 0) / bookAnchors.length
      : null

  return (
    <>
      <header className="table-head">
        <h1>Win Expectancy, by Game State</h1>
        <p className="subtitle">
          {sel.seasonLabel} &nbsp;&middot;&nbsp; {sel.teamLabel}
        </p>
        <p className="credit">
          Table&nbsp;10 from Tom Tango's <em>The Book</em>. The Table&nbsp;8 Markov run model is
          extended half-inning by half-inning through the game to estimate the home team's chance to
          win from any inning, score, and base/out state.
        </p>
      </header>

      <section className="we-console" aria-label="Game state controls">
        <div className="we-field">
          <span>Inning</span>
          <div className="seg">
            {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className={inning === n ? 'on' : ''} onClick={() => setInning(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="we-field">
          <span>Half</span>
          <div className="seg half">
            {['top', 'bottom'].map((h) => (
              <button key={h} type="button" className={half === h ? 'on' : ''} onClick={() => setHalf(h)}>
                {h === 'top' ? 'Top' : 'Bottom'}
              </button>
            ))}
          </div>
        </div>
        <div className="we-field score">
          <span>Home Score</span>
          <div className="seg">
            {SCORE_DIFFS.map((scoreDiff) => (
              <button
                key={scoreDiff}
                type="button"
                className={diff === scoreDiff ? 'on' : ''}
                onClick={() => setDiff(scoreDiff)}
              >
                {scoreDiff === 0 ? 'Tie' : scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff}
              </button>
            ))}
          </div>
        </div>
      </section>

      {rows == null ? (
        <div className="empty">Loading event data…</div>
      ) : model.totalTransitions > 0 ? (
        <>
          <section className="we-hero">
            <div>
              <span className="we-kicker">Selected State</span>
              <strong>{stateLabel(selectedBase, selectedOuts)}</strong>
              <span>
                {inning}{inning === 1 ? 'st' : inning === 2 ? 'nd' : inning === 3 ? 'rd' : 'th'} inning,{' '}
                {half}, {scoreDiffLabel(diff)}
              </span>
            </div>
            <div className="we-big">{pct(selectedWE)}</div>
            <div className="we-delta">
              <span>vs. empty/0 out</span>
              <strong>{selectedWE == null || emptyWE == null ? '—' : `${((selectedWE - emptyWE) * 100).toFixed(1)} pts`}</strong>
            </div>
          </section>

          <div className="we-strip" aria-label="Selected state by score differential">
            {selectedStrip.map((item) => (
              <button
                key={item.diff}
                type="button"
                className={diff === item.diff ? 'on' : ''}
                onClick={() => setDiff(item.diff)}
                style={{ background: winColor(item.we) }}
              >
                <span>{item.diff === 0 ? 'Tie' : item.diff > 0 ? `+${item.diff}` : item.diff}</span>
                <strong>{pct(item.we)}</strong>
              </button>
            ))}
          </div>

          <table className="ev t10">
            <thead>
              <tr>
                <th className="b">1B</th>
                <th className="b">2B</th>
                <th className="b">3B</th>
                <th className="num">Outs</th>
                <th className="num">Home WE</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={stateKey(r.base, r.outs)}
                  className={`${r.outs === 2 ? 'group-end' : ''} ${stateKey(r.base, r.outs) === selectedKey ? 'selected' : ''}`}
                  onClick={() => setSelectedKey(stateKey(r.base, r.outs))}
                >
                  <td className="b">{onFirst(r.base) ? '1B' : '––'}</td>
                  <td className="b">{onSecond(r.base) ? '2B' : '––'}</td>
                  <td className="b">{onThird(r.base) ? '3B' : '––'}</td>
                  <td className="num">{r.outs}</td>
                  <td className="num we-cell" style={{ background: winColor(r.we) }}>
                    {fixed(r.we)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <details className="book-compare" open>
            <summary>Book comparison anchors</summary>
            <p>
              Using 1999–2002, all teams, compared against representative values read from the
              Table&nbsp;10 screenshots. Mean absolute gap:{' '}
              <strong>{meanAbsGap == null ? '—' : meanAbsGap.toFixed(3)}</strong>.
            </p>
            <table className="mini-compare">
              <thead>
                <tr>
                  <th>State</th>
                  <th className="num">Book</th>
                  <th className="num">Model</th>
                  <th className="num">Diff</th>
                </tr>
              </thead>
              <tbody>
                {bookAnchors.map((anchor) => (
                  <tr key={anchor.label}>
                    <td>{anchor.label}</td>
                    <td className="num">{anchor.book.toFixed(3)}</td>
                    <td className="num">{fixed(anchor.model)}</td>
                    <td className={`num delta ${anchor.diff == null ? '' : anchor.diff >= 0 ? 'pos' : 'neg'}`}>
                      {anchor.diff == null ? '—' : `${anchor.diff >= 0 ? '+' : '−'}${Math.abs(anchor.diff).toFixed(3)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          <p className="hint">
            Score is from the home team's point of view. Values are home-team win expectancy.
            Impossible book states, such as home leading in the bottom of the ninth, are blanked.
          </p>
        </>
      ) : (
        <div className="empty">Select at least one team to compute the table.</div>
      )}

      <details className="method">
        <summary>How this is calculated</summary>
        <p>
          First, the site solves the Markov chain for the full probability distribution of runs in
          the current half-inning from each base/out state. Then it recursively combines those
          half-inning distributions through the rest of regulation. After the ninth, ties are treated
          as a 50/50 game, which matches the book's Table&nbsp;10 convention.
        </p>
        <p className="src">Source: {stateData ? stateData.meta.source : ''}.</p>
      </details>
    </>
  )
}
