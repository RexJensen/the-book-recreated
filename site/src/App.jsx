import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import reData from './data/re_dataset.json'
import { buildTeams, useSelection } from './components/selection.js'
import Filters from './components/Filters.jsx'
import Home from './Home.jsx'
import { TABLES } from './tables/registry.js'

const SEASONS = reData.meta.seasons
const TEAMS = buildTeams(reData.groups)

export default function App() {
  // one shared selection for the whole site, so filters carry across tables
  const sel = useSelection(SEASONS, TEAMS)
  const location = useLocation()
  const onTablePage = location.pathname !== '/'

  return (
    <div className="shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          The Book<span>, recreated</span>
        </NavLink>

        <nav className="nav">
          <NavLink to="/" end className="nav-link">
            Home
          </NavLink>
          {TABLES.map((t) => (
            <NavLink key={t.path} to={`/${t.path}`} className="nav-link">
              <span className="nav-num">Table {t.num}</span>
              <span className="nav-name">{t.title}</span>
            </NavLink>
          ))}
        </nav>

        {onTablePage && (
          <>
            <div className="sidebar-divider" />
            <Filters sel={sel} />
          </>
        )}

        <div className="sidebar-foot">
          Retrosheet play-by-play, {SEASONS[0]}–{SEASONS[SEASONS.length - 1]}
        </div>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          {TABLES.map(({ path, Component }) => (
            <Route key={path} path={`/${path}`} element={<Component sel={sel} />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
