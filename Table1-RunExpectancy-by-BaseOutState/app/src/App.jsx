import { useMemo, useState } from 'react'
import data from './data/re_dataset.json'
import { teamName } from './teams.js'

// --- static facts about the dataset -------------------------------------------
const SEASONS = data.meta.seasons // e.g. [2021,2022,2023,2024,2025]
const BASE_ORDER = data.meta.baseOrder // [0,1,2,4,3,5,6,7]
const OUTS = [0, 1, 2]

// every (team, league) pair that appears, sorted by league then name
const TEAMS = (() => {
  const seen = new Map()
  for (const g of data.groups) if (!seen.has(g.team)) seen.set(g.team, g.league)
  // disambiguate display names shared by two codes (e.g. OAK vs ATH -> Athletics)
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

// base bits: 1=on first, 2=on second, 4=on third
const onFirst = (b) => b & 1
const onSecond = (b) => b & 2
const onThird = (b) => b & 4

// green heat colour for a value within [min,max]
function heat(v, min, max) {
  if (v == null) return 'transparent'
  const t = max > min ? (v - min) / (max - min) : 0.5
  // pale -> deep green
  const light = 96 - t * 52
  return `hsl(140 55% ${light}%)`
}

export default function App() {
  const [seasons, setSeasons] = useState(() => new Set(SEASONS))
  const [league, setLeague] = useState('ALL') // ALL | AL | NL
  const [teams, setTeams] = useState(() => new Set(TEAMS.map((t) => t.team)))

  const visibleTeams = useMemo(
    () => TEAMS.filter((t) => league === 'ALL' || t.league === league),
    [league],
  )

  // --- aggregate the additive cells over the current selection ----------------
  const { matrix, totalPA, valid, lo, hi } = useMemo(() => {
    // key = base*10 + outs  ->  {count, sumRuns}
    const acc = {}
    for (const o of OUTS) for (const b of BASE_ORDER) acc[b * 10 + o] = { count: 0, sumRuns: 0 }

    for (const g of data.groups) {
      if (!seasons.has(g.season)) continue
      if (league !== 'ALL' && g.league !== league) continue
      if (!teams.has(g.team)) continue
      for (const c of g.cells) {
        const k = c.base * 10 + c.outs
        acc[k].count += c.count
        acc[k].sumRuns += c.sumRuns
      }
    }

    let totalPA = 0
    const matrix = {}
    let lo = Infinity
    let hi = -Infinity
    for (const k in acc) {
      const { count, sumRuns } = acc[k]
      totalPA += count
      const re = count ? sumRuns / count : null
      matrix[k] = { re, count }
      if (re != null) {
        lo = Math.min(lo, re)
        hi = Math.max(hi, re)
      }
    }
    return {
      matrix,
      totalPA,
      valid: totalPA > 0,
      lo: Number.isFinite(lo) ? lo : 0,
      hi: Number.isFinite(hi) ? hi : 1,
    }
  }, [seasons, league, teams])

  const overall = matrix[0]?.re // bases empty, 0 outs == avg runs / inning

  // --- selection helpers ------------------------------------------------------
  const toggleSeason = (s) =>
    setSeasons((prev) => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next.size ? next : prev // never allow zero seasons
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

  const allVisibleSelected = visibleTeams.every((t) => teams.has(t.team))

  const seasonLabel =
    seasons.size === SEASONS.length
      ? `${SEASONS[0]}–${SEASONS[SEASONS.length - 1]}`
      : [...seasons].sort().join(', ')

  const teamLabel = allVisibleSelected
    ? league === 'ALL'
      ? 'All Teams'
      : `All ${league}`
    : `${teams.size} team${teams.size === 1 ? '' : 's'}`

  return (
    <div className="page">
      <header>
        <h1>Run Expectancy, By The 24 Base/Out States</h1>
        <p className="subtitle">
          {seasonLabel} &nbsp;&middot;&nbsp; {teamLabel}
          {league !== 'ALL' && allVisibleSelected ? '' : ''}
        </p>
        <p className="credit">
          Recreating Table 1 from Tom Tango's <em>The Book</em> &mdash; live from Retrosheet
          play-by-play.
        </p>
      </header>

      <div className="layout">
        {/* ---------------- controls ---------------- */}
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
        </aside>

        {/* ---------------- table ---------------- */}
        <main>
          {valid ? (
            <>
              <div className="headline">
                <div className="big">{overall != null ? overall.toFixed(3) : '—'}</div>
                <div className="big-label">
                  overall run expectancy
                  <span>bases empty, 0 outs &mdash; i.e. avg runs / inning</span>
                </div>
                <div className="sample">{totalPA.toLocaleString()} plate appearances</div>
              </div>

              <table className="re">
                <thead>
                  <tr>
                    <th className="b">1B</th>
                    <th className="b">2B</th>
                    <th className="b">3B</th>
                    <th>0 Outs</th>
                    <th>1 Out</th>
                    <th>2 Outs</th>
                  </tr>
                </thead>
                <tbody>
                  {BASE_ORDER.map((b) => (
                    <tr key={b}>
                      <td className="b">{onFirst(b) ? '1B' : '––'}</td>
                      <td className="b">{onSecond(b) ? '2B' : '––'}</td>
                      <td className="b">{onThird(b) ? '3B' : '––'}</td>
                      {OUTS.map((o) => {
                        const cell = matrix[b * 10 + o]
                        return (
                          <td
                            key={o}
                            className="val"
                            style={{ background: heat(cell.re, lo, hi) }}
                            title={cell.count ? `${cell.count.toLocaleString()} PA` : 'no data'}
                          >
                            {cell.re != null ? cell.re.toFixed(3) : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="hint">Hover any cell to see its sample size.</p>
            </>
          ) : (
            <div className="empty">Select at least one team to compute run expectancy.</div>
          )}

          <details className="method">
            <summary>How this is calculated</summary>
            <p>{data.meta.method}.</p>
            <p>
              For every plate appearance we record the base/out state at its start and the runs the
              batting team went on to score before the inning ended. The run expectancy of a state
              is the average of those values over the selected seasons, leagues and teams. Only
              innings that ended with three outs are counted, so walk-off and game-ending partial
              innings don't bias the late-inning numbers.
            </p>
            <p className="src">Source: {data.meta.source}.</p>
          </details>
        </main>
      </div>
    </div>
  )
}
