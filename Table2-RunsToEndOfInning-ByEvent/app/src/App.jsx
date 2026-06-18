import { useMemo, useState } from 'react'
import data from './data/event_dataset.json'
import { teamName } from './teams.js'

const SEASONS = data.meta.seasons
// [key, label] in the book's display order; the table itself re-sorts by average
const CATS = data.meta.categories
const LABELS = Object.fromEntries(CATS)
// categories that did NOT appear in the book's original Table 2
const NOT_IN_BOOK = new Set(['FC', 'FLE', 'OTHER'])

const TEAMS = (() => {
  const seen = new Map()
  for (const g of data.groups) if (!seen.has(g.team)) seen.set(g.team, g.league)
  const nameCount = {}
  for (const code of seen.keys()) nameCount[teamName(code)] = (nameCount[teamName(code)] || 0) + 1
  return [...seen.entries()]
    .map(([team, league]) => ({
      team,
      league,
      label: nameCount[teamName(team)] > 1 ? `${teamName(team)} (${team})` : teamName(team),
    }))
    .sort((a, b) =>
      a.league === b.league ? a.label.localeCompare(b.label) : a.league.localeCompare(b.league),
    )
})()

export default function App() {
  const [seasons, setSeasons] = useState(() => new Set(SEASONS))
  const [league, setLeague] = useState('ALL')
  const [teams, setTeams] = useState(() => new Set(TEAMS.map((t) => t.team)))
  const [showExtra, setShowExtra] = useState(false)

  const visibleTeams = useMemo(
    () => TEAMS.filter((t) => league === 'ALL' || t.league === league),
    [league],
  )

  // --- aggregate additive (count, sumRuns) per event category ----------------
  const rows = useMemo(() => {
    const acc = {} // cat -> {count, sumRuns}
    for (const g of data.groups) {
      if (!seasons.has(g.season)) continue
      if (league !== 'ALL' && g.league !== league) continue
      if (!teams.has(g.team)) continue
      for (const cat in g.cells) {
        if (!acc[cat]) acc[cat] = { count: 0, sumRuns: 0 }
        acc[cat].count += g.cells[cat].count
        acc[cat].sumRuns += g.cells[cat].sumRuns
      }
    }
    return Object.entries(acc)
      .map(([cat, v]) => ({
        cat,
        label: LABELS[cat] || cat,
        count: v.count,
        sumRuns: v.sumRuns,
        avg: v.count ? v.sumRuns / v.count : 0,
        extra: NOT_IN_BOOK.has(cat),
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.avg - a.avg)
  }, [seasons, league, teams])

  const shown = showExtra ? rows : rows.filter((r) => !r.extra)
  const maxAvg = Math.max(0.001, ...shown.map((r) => r.avg))
  const totalN = shown.reduce((s, r) => s + r.count, 0)

  // --- selection helpers ------------------------------------------------------
  const toggleSeason = (s) =>
    setSeasons((prev) => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next.size ? next : prev
    })
  const changeLeague = (lg) => {
    setLeague(lg)
    setTeams(new Set(TEAMS.filter((t) => lg === 'ALL' || t.league === lg).map((t) => t.team)))
  }
  const toggleTeam = (team) =>
    setTeams((prev) => {
      const next = new Set(prev)
      next.has(team) ? next.delete(team) : next.add(team)
      return next
    })

  const seasonLabel =
    seasons.size === SEASONS.length
      ? `${SEASONS[0]}–${SEASONS[SEASONS.length - 1]}`
      : [...seasons].sort().join(', ')
  const allVisibleSelected = visibleTeams.every((t) => teams.has(t.team))
  const teamLabel = allVisibleSelected
    ? league === 'ALL'
      ? 'All Teams'
      : `All ${league}`
    : `${teams.size} team${teams.size === 1 ? '' : 's'}`

  return (
    <div className="page">
      <header>
        <h1>Runs To End Of Inning, By Event</h1>
        <p className="subtitle">
          {seasonLabel} &nbsp;&middot;&nbsp; {teamLabel}
        </p>
        <p className="credit">
          Recreating Table 2 from Tom Tango's <em>The Book</em> &mdash; live from Retrosheet
          play-by-play.
        </p>
      </header>

      <div className="layout">
        <aside className="controls">
          <section>
            <h3>Seasons</h3>
            <div className="chips">
              {SEASONS.map((s) => (
                <button
                  key={s}
                  className={`chip ${seasons.has(s) ? 'on' : ''}`}
                  onClick={() => toggleSeason(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3>League</h3>
            <div className="chips">
              {['ALL', 'AL', 'NL'].map((lg) => (
                <button
                  key={lg}
                  className={`chip ${league === lg ? 'on' : ''}`}
                  onClick={() => changeLeague(lg)}
                >
                  {lg === 'ALL' ? 'Both' : lg}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="section-head">
              <h3>Teams</h3>
              <div className="mini-actions">
                <button onClick={() => setTeams(new Set(visibleTeams.map((t) => t.team)))}>
                  All
                </button>
                <button onClick={() => setTeams(new Set())}>None</button>
              </div>
            </div>
            <div className="team-grid">
              {visibleTeams.map((t) => (
                <button
                  key={t.team}
                  className={`team ${teams.has(t.team) ? 'on' : ''}`}
                  onClick={() => toggleTeam(t.team)}
                  title={`${t.team} (${t.league})`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <label className="toggle">
              <input
                type="checkbox"
                checked={showExtra}
                onChange={(e) => setShowExtra(e.target.checked)}
              />
              Show events not in the book
            </label>
          </section>
        </aside>

        <main>
          {totalN > 0 ? (
            <>
              <table className="ev">
                <thead>
                  <tr>
                    <th className="evt">Event</th>
                    <th className="code">code</th>
                    <th className="num">N</th>
                    <th className="num">Runs to End of Inning</th>
                    <th className="num avg">Average Runs</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.cat} className={r.extra ? 'extra' : ''}>
                      <td className="evt">
                        {r.label}
                        {r.extra && <span className="tag">not in book</span>}
                      </td>
                      <td className="code">{r.cat}</td>
                      <td className="num">{r.count.toLocaleString()}</td>
                      <td className="num">{Math.round(r.sumRuns).toLocaleString()}</td>
                      <td className="num avg">
                        <span className="bar" style={{ width: `${(r.avg / maxAvg) * 100}%` }} />
                        <span className="bar-val">{r.avg.toFixed(3)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="hint">
                {totalN.toLocaleString()} events &middot; sorted by average runs to end of inning.
                The bar shows each event's average relative to the highest.
              </p>
            </>
          ) : (
            <div className="empty">Select at least one team to compute the table.</div>
          )}

          <details className="method">
            <summary>How this is calculated</summary>
            <p>{data.meta.method}.</p>
            <p>
              For every occurrence of an event we take the runs the batting team scored from that
              point until the inning ended &mdash; the same &ldquo;runs to end of inning&rdquo; value
              behind the Table&nbsp;1 run-expectancy matrix &mdash; and average it by event type.
              Unlike Table&nbsp;1, every event counts, not just plate appearances, so stolen bases,
              wild pitches, balks and pickoffs each get a row. Only innings that ended with three
              outs are included.
            </p>
            <p>
              The averages reflect the <em>situations</em> events tend to occur in as much as the
              events themselves: a sacrifice bunt scores high because you only bunt with runners
              already on base, while a strikeout scores low partly because it adds an out.
            </p>
            <p className="src">Source: {data.meta.source}.</p>
          </details>
        </main>
      </div>
    </div>
  )
}
