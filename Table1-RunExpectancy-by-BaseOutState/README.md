# Run Expectancy by the 24 Base/Out States — interactive

An interactive React recreation of **Table 1** from Tom Tango's *The Book*
(`Screenshot 2026-06-17 at 9.39.24 PM.png` is the original). Instead of fixed
1999–2002 numbers, this computes the matrix live from Retrosheet play-by-play
and lets you slice it.

## Controls

- **Seasons** — toggle any of 2021–2025 (multi-select; at least one stays on).
- **League** — Both / AL / NL. Switching restricts the team list.
- **Teams** — pick any subset of teams, or use *All* / *None*.

The 24-cell table, the heatmap shading, the headline "overall run expectancy"
(bases empty / 0 outs = average runs per inning) and the plate-appearance count
all update instantly. Hover a cell to see its sample size.

## Run it

```bash
cd app
npm install          # if the global npm cache errors: add  --cache /tmp/npm-cache
npm run dev          # opens http://localhost:5173
```

## How it works

`app/src/data/re_dataset.json` is produced by `../Database/scripts/run_expectancy.py`.
It stores, per (season, team), the `count` and `sumRuns` for each of the 24
base/out states. Those are **additive**, so the app simply sums the cells for
the current selection and divides — `runExpectancy = sumRuns / count`. See the
Database README for how the underlying numbers are computed.

To add more seasons later: download them in `../Database`, re-run the Python
script, and copy the refreshed `re_dataset.json` into `app/src/data/`.
