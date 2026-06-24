import { useEffect, useMemo, useState } from 'react'

// The Seasons / League / Teams control panel, driven by a useSelection() object.
export default function Filters({ sel, children }) {
  const [teamSearch, setTeamSearch] = useState('')
  const [expanded, setExpanded] = useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 821px)').matches,
  )
  const filteredTeams = useMemo(() => {
    const q = teamSearch.trim().toLowerCase()
    if (!q) return sel.visibleTeams
    return sel.visibleTeams.filter((t) => `${t.label} ${t.codes.join(' ')}`.toLowerCase().includes(q))
  }, [sel.visibleTeams, teamSearch])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 821px)')
    const sync = () => setExpanded(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return (
    <div className={`filters ${expanded ? 'expanded' : ''}`}>
      <button className="filter-toggle" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        <span>Filters</span>
        <strong>
          {sel.seasonLabel} · {sel.league === 'ALL' ? 'Both' : sel.league} · {sel.teamLabel}
        </strong>
      </button>

      <div className="filter-body">
        <section>
          <div className="section-head">
            <h3>Seasons</h3>
            <span className="filter-count">{sel.seasons.size} selected</span>
          </div>
          <div className="range-row">
            <label>
              <span>From</span>
              <select value={sel.seasonStart} onChange={(e) => sel.setSeasonRange(e.target.value, sel.seasonEnd)}>
                {sel.seasonList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>To</span>
              <select value={sel.seasonEnd} onChange={(e) => sel.setSeasonRange(sel.seasonStart, e.target.value)}>
                {sel.seasonList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="preset-row">
            <button onClick={sel.selectAllSeasons}>All</button>
            <button onClick={sel.selectBookSeasons}>Book era</button>
            <button onClick={sel.selectRecentSeasons}>Last 10</button>
          </div>
        </section>

        <section>
          <h3>League</h3>
          <div className="chips">
            {['ALL', 'AL', 'NL'].map((lg) => (
              <button
                key={lg}
                className={`chip ${sel.league === lg ? 'on' : ''}`}
                onClick={() => sel.changeLeague(lg)}
              >
                {lg === 'ALL' ? 'Both' : lg}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="section-head">
            <h3>Teams</h3>
            <span className="filter-count">{sel.teamLabel}</span>
            <div className="mini-actions">
              <button onClick={sel.selectAll}>All</button>
              <button onClick={sel.selectNone}>None</button>
            </div>
          </div>
          <input
            className="team-search"
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
            placeholder="Find a team"
            type="search"
          />
          <div className="team-grid">
            {filteredTeams.map((t) => (
              <button
                key={t.key}
                className={`team ${sel.teamSelected(t) ? 'on' : ''} ${sel.teamPartial(t) ? 'partial' : ''}`}
                onClick={() => sel.toggleTeam(t)}
                title={`${t.codes.join(', ')} · ${t.leagues.join('/')}`}
              >
                <span>{t.label}</span>
                {t.codes.length > 1 && <small>{t.codes.join('/')}</small>}
              </button>
            ))}
          </div>
          {filteredTeams.length === 0 && <div className="filter-empty">No teams match that search.</div>}
        </section>

        {children}
      </div>
    </div>
  )
}
