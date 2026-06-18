// The Seasons / League / Teams control panel, driven by a useSelection() object.
export default function Filters({ sel, children }) {
  return (
    <div className="filters">
      <section>
        <h3>Seasons</h3>
        <div className="chips">
          {sel.seasonList.map((s) => (
            <button
              key={s}
              className={`chip ${sel.seasons.has(s) ? 'on' : ''}`}
              onClick={() => sel.toggleSeason(s)}
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
          <div className="mini-actions">
            <button onClick={sel.selectAll}>All</button>
            <button onClick={sel.selectNone}>None</button>
          </div>
        </div>
        <div className="team-grid">
          {sel.visibleTeams.map((t) => (
            <button
              key={t.team}
              className={`team ${sel.teams.has(t.team) ? 'on' : ''}`}
              onClick={() => sel.toggleTeam(t.team)}
              title={`${t.team} (${t.league})`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {children}
    </div>
  )
}
