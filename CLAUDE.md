# The Book, Recreated

Interactive recreations of the tables from **Tom Tango, Mitchel Lichtman & Andrew
Dolphin's _The Book: Playing the Percentages in Baseball_**, computed from real
**Retrosheet** play-by-play data (1980–2025).

- **Live site:** https://the-book-recreated.vercel.app
- **Hosting:** Vercel (project `the-book-recreated`, account `rexjensen`)
- This project is built one table at a time, working through the book.

---

## Repository layout

```
Tango_book_recreation/
├── CLAUDE.md / AGENTS.md      ← this file (AGENTS.md is an exact copy)
├── Database/                  ← data pipeline: Retrosheet → run expectancy
│   ├── build_all.sh           ← one command to (re)build everything
│   ├── scripts/
│   │   ├── run_expectancy.py        → out/re_dataset.json      (Table 1)
│   │   ├── runs_by_event.py         → out/event_dataset.json   (Table 2, standalone)
│   │   └── event_starting_state.py  → out/event_states.json    (Tables 2–4 on the site)
│   ├── raw/<year>/            ← extracted Retrosheet event files (.EVA/.EVN/.ROS)
│   └── out/                   ← generated CSVs + JSON datasets
├── site/                      ← THE DEPLOYED APP (Vite + React + React Router)
│   ├── src/
│   │   ├── App.jsx            ← shell: sidebar nav + shared filters + routes
│   │   ├── Home.jsx           ← landing page (data-driven from the table registry)
│   │   ├── tables/
│   │   │   ├── registry.js    ← list of tables; add one entry to add a page
│   │   │   ├── Table1.jsx     ← the 24 base/out RE matrix
│   │   │   └── Table2to4.jsx  ← combined Runs-to-end / Starting RE / Run Value
│   │   ├── components/
│   │   │   ├── selection.js   ← useSelection() hook + matchesSelection()
│   │   │   ├── Filters.jsx    ← the Seasons/League/Teams control panel
│   │   │   └── reMatrix.js    ← shared RE-matrix aggregation (Table 1 + 2–4)
│   │   ├── data/              ← JSON datasets copied from Database/out
│   │   │   ├── re_dataset.json      (1.5 MB, imported eagerly)
│   │   │   └── event_states.json    (5.2 MB, dynamically imported — /run-value + /state-run-value)
│   │   ├── teams.js           ← Retrosheet team code → display name map
│   │   └── styles.css
│   └── vercel.json            ← SPA rewrite so deep links work
├── Table1-RunExpectancy-by-BaseOutState/   ← LEGACY standalone app (superseded by site/)
├── Table2-RunsToEndOfInning-ByEvent/       ← LEGACY standalone app (superseded by site/)
├── Table3/  Table4/                        ← reference screenshots from the book
```

The `Table1-…/app` and `Table2-…/app` folders are early standalone versions kept
as sandboxes. **`site/` is the single source of truth for what's deployed.** They
can be deleted if you want to declutter.

---

## What's done

| Book table(s) | Site page | What it shows |
|---|---|---|
| **Table 1** | `/table-1` | Run expectancy for the 24 base/out states. |
| **Tables 2, 3 & 4** | `/run-value` | One sortable table per event type: N, runs to end of inning, **Average** (Table 2), **Starting RE** (Table 3), and **Run Value = Average − Starting RE** (Table 4). |
| **Table 5** | `/state-run-value` | Pick one event type (defaults to HR) and see its N, runs to end of inning, **Average**, **Starting RE**, and **Run Value** broken out across all 24 base/out states. The inverse cut of Tables 2–4: one event, all states (vs. one row per event, aggregated over states). |

Seasons loaded: **1980–2025** (46 seasons, ~8.1M events). Every page recomputes
live for whatever **Seasons / League / Teams** you select in the sidebar, and the
selection persists as you move between tables.

> The numbers run a little below the book's original 1999–2002 figures because
> those were a high-offense era. Year-to-year they track the real run environment
> (e.g. 1981 strike year ≈ 0.436 runs/inning, 2023 ≈ 0.513).

---

## The data pipeline (`Database/`)

### There is no Retrosheet API
Retrosheet publishes one ZIP of play-by-play **event files** per season at
`https://www.retrosheet.org/events/<YEAR>eve.zip`. Each ZIP has one `.EVA`
(American League home games) or `.EVN` (National League home games) file per
team. We parse them with **Chadwick** (`cwevent`), the standard open-source
Retrosheet toolkit.

### Dependencies
- **Chadwick** — `brew install chadwick` (provides `cwevent`, `cwgame`).
- **Python 3** — standard library only (no pip packages needed for the pipeline).
- **Node 20+ / npm** — for the site.

### Rebuild everything
```bash
cd Database
bash build_all.sh 1980 2025      # downloads (if missing), converts, aggregates
```
This downloads/extracts each season into `raw/<year>/`, converts the events to
`out/events_<year>.csv` with `cwevent`, then runs the three Python aggregators.
Re-running is safe — existing downloads are reused. To add a year, just widen the
range (e.g. `bash build_all.sh 1979 2025`).

> **Disk note:** the intermediate `out/events_*.csv` files are large (~550 MB for
> 46 seasons) and are deleted after a build to save space. They are fully
> regenerable by re-running `build_all.sh` (which re-runs `cwevent` over `raw/`).
> `raw/` is ~500 MB; delete it to reclaim space — `build_all.sh` re-downloads.

### How run expectancy is computed
The standard Retrosheet recipe (Marchi & Albert, _Analyzing Baseball Data with R_):

1. For each play, note the **base/out state at its start** and the runs already scored.
2. `runs to end of inning (RUNS.ROI) = (runs at inning start + runs scored in the
   whole inning) − runs already scored before this play`.
3. Keep only innings that ended in **exactly 3 outs** (drops walk-off / game-ending
   partial innings that would bias late-inning, runners-on states).
4. **Run expectancy of a state** (Table 1) = mean RUNS.ROI over every *plate
   appearance* that began in that state.
5. **Average runs by event** (Table 2) = mean RUNS.ROI over every occurrence of an
   event type (all events, not just PAs — so steals, WP, balks, pickoffs count).
6. **Starting RE by event** (Table 3) = average, over occurrences, of the Table 1
   RE of the state the event started in.
7. **Run value** (Table 4) = Average − Starting RE: the average change in run
   expectancy an event produces. Positive for hits/walks, negative for outs — and
   notably **negative for the sacrifice bunt** (it lowers run expectancy on average).

### Datasets are additive
Each JSON stores, per **(season, team)**, raw `count` and `sumRuns` (and, for
events, the distribution of starting base/out states as `[count, sumRuns]` per
state — count drives Table 3's starting RE, the per-state runs drive Table 5).
These are additive, so the
browser sums whatever seasons/league/teams are selected and divides — no
recomputation, every filter combination is exact. (`sumRuns` are integer run
totals.) League is assigned per season from each team's home-file extension
(`.EVA`=AL, `.EVN`=NL), which correctly handles franchises that switched leagues
(e.g. Brewers, Astros) and relocated (Expos→Nationals, OAK→ATH).

### `cwevent` fields used
`cwevent -f 0,1,2,3,4,8,9,26,27,28,34,35,38,40,48,58,59,60,61` →
game_id, vis_team, inning, bat_home flag, outs, vis/home score, runners on
1/2/3, event type, batter-event flag, sacrifice-hit flag, outs-on-play, bunt
flag, batter/runner destinations (dest ≥ 4 = scored). Get the authoritative field
numbers with `cwevent -d` (they differ from some online recipes).

---

## The site (`site/`)

### Run locally
```bash
cd site
npm install --cache /tmp/npm-cache    # see npm-cache note below
npm run dev                            # http://localhost:5173 (or as assigned)
```

### Architecture
- **One shared selection.** `useSelection()` (in `components/selection.js`) holds
  Seasons/League/Teams and lives in `App.jsx`, so filters carry across all tables.
- **`Filters.jsx`** renders the sidebar control panel from that selection.
- **`reMatrix.js`** aggregates the Table 1 RE matrix for the current selection;
  used by both Table 1 and the Run Value page (the latter needs RE to look up each
  event's Starting RE).
- **Tables are presentational** components that take `sel` as a prop and render a
  computed table. They read datasets and aggregate with `matchesSelection(g, sel)`.
- **Routing** is React Router (`/table-1`, `/run-value`). `vercel.json` rewrites
  all paths to `index.html` so deep links work.

### Add a new table
1. Compute its data in `Database/` (extend a script or add one) → JSON in
   `Database/out/`, then copy into `site/src/data/`.
2. Create `site/src/tables/TableN.jsx` — a component taking `{ sel }`, using
   `computeREMatrix(sel)` and/or `matchesSelection(g, sel)` to aggregate.
   Dynamically `import()` any large (>1 MB) dataset so it only loads on that page.
3. Add one entry to `site/src/tables/registry.js` (`{ path, num, title, blurb,
   Component }`). It appears in the nav and on the home page automatically.
4. `npm run build` to check, then deploy.

### After regenerating data, refresh the site copies
```bash
cp Database/out/re_dataset.json Database/out/event_states.json site/src/data/
```

---

## Deployment (Vercel)

```bash
cd site
npm_config_cache=/tmp/npm-cache npx vercel deploy --prod --yes
```
Deploys to **https://the-book-recreated.vercel.app** (the project is already
linked via `site/.vercel/`). Vite is auto-detected; Vercel runs `npm run build`
and serves `dist/`.

**Gotchas learned:**
- **npm cache:** the user's global `~/.npm` cache throws `EACCES`. Prefix npm/npx
  with `npm_config_cache=/tmp/npm-cache` (or fix permissions:
  `sudo chown -R $(whoami) ~/.npm`).
- **Deployment Protection:** new Vercel projects default to "Vercel
  Authentication" ON, which returns **HTTP 401** behind a login wall. It was
  disabled via the API so the site is public:
  ```
  PATCH https://api.vercel.com/v9/projects/<projectId>?teamId=<orgId>
  body: {"ssoProtection": null}        # token in ~/Library/Application Support/com.vercel.cli/auth.json
  ```
  Project/org ids are in `site/.vercel/project.json`.

---

## Conventions
- Aesthetic: serif headings (book feel), dark-green sidebar, green accent, green→
  white heatmap on Table 1, color-coded (green/red) run values.
- Keep components presentational and selection logic shared; don't duplicate the
  RE-matrix aggregation — use `reMatrix.js`.
- Events not in the book (fielder's choice, foul error, "other") are included for
  honest totals but hidden behind a toggle and tagged "not in book".
