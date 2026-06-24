import { Link } from 'react-router-dom'
import data from './data/re_dataset.json'
import { TABLES } from './tables/registry.js'

const seasons = data.meta.seasons
const totalPlateAppearances = data.groups.reduce(
  (sum, g) => sum + g.cells.reduce((cellSum, c) => cellSum + c.count, 0),
  0,
)

export default function Home() {
  return (
    <div className="home">
      <header className="table-head">
        <h1>The Book, Recreated</h1>
        <p className="subtitle">Run expectancy from real play-by-play</p>
        <p className="credit">
          Interactive recreations of the tables from Tom Tango, Mitchel Lichtman &amp; Andrew
          Dolphin's <em>The Book: Playing the Percentages in Baseball</em>, computed from{' '}
          <strong>Retrosheet</strong> play-by-play for the {seasons[0]}–{seasons[seasons.length - 1]}{' '}
          seasons.
        </p>
      </header>

      <p className="intro">
        Pick any combination of seasons, league and teams in the sidebar — every table recomputes
        live from {totalPlateAppearances.toLocaleString()} plate appearances. The numbers run a
        touch below the book's original 1999–2002 figures, reflecting today's lower-offense era.
      </p>

      <div className="cards">
        {TABLES.map((t) => (
          <Link key={t.path} to={`/${t.path}`} className="card">
            <div className="card-num">Table {t.num}</div>
            <div className="card-title">{t.title}</div>
            <div className="card-blurb">{t.blurb}</div>
            <div className="card-go">Open &rarr;</div>
          </Link>
        ))}
      </div>

      <p className="src-note">
        Data: Retrosheet event files, parsed with Chadwick <code>cwevent</code> and aggregated
        locally. Run expectancy = mean runs to the end of the inning, excluding partial innings
        and home halves of the ninth or later.
      </p>
    </div>
  )
}
