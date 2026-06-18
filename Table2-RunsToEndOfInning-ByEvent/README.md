# Runs To End Of Inning, By Event — interactive

An interactive React recreation of **Table 2** from Tom Tango's *The Book*
(`Table2-Book.png` is the original). It ranks event types by the average number
of runs the batting team scores from that event to the end of the inning.

## The key idea

This uses the **exact same "runs to end of inning" value** that powers the
Table 1 run-expectancy matrix — but instead of grouping by base/out state, it
groups by the **type of event** (home run, single, strikeout, stolen base, …).
And unlike Table 1, *every* event is counted, not just plate appearances, so
steals, wild pitches, balks and pickoffs each get their own row.

```
Average runs for an event = mean( runs from that event to end of inning )
                            over every occurrence, complete (3-out) innings only
```

The averages describe the *situations* events tend to happen in as much as the
events themselves: a sacrifice bunt scores high because you only bunt with
runners already on base; a strikeout scores low partly because it adds an out.

## Controls

- **Seasons** (2021–2025, multi-select), **League** (Both/AL/NL), **Teams**
  (any subset). The table re-sorts and recomputes instantly.
- **Show events not in the book** — reveals Fielder's Choice, Foul Error and an
  "Other" bucket. These weren't in Tango's original Table 2; they're included so
  the event totals reconcile honestly. They're tagged and shaded when shown.

## Run it

```bash
cd app
npm install          # if the global npm cache errors: add  --cache /tmp/npm-cache
npm run dev          # http://localhost:5174
```

## Data

`app/src/data/event_dataset.json` comes from
`../Database/scripts/runs_by_event.py`, which reads the same Retrosheet event
CSVs as Table 1 (it needs the `event_cd`, `sh_fl` and `bunt_fl` columns) and
stores, per (season, team, event), an additive `count` + `sumRuns`. The app
sums the current selection and divides — `average = sumRuns / count`.
Human-readable per-season tables are also written to
`../Database/out/re_by_event_<year>.csv`.

## How it compares to the book (1999–2002 → 2021–2025)

The ordering is essentially identical; every value is a touch lower, matching
the lower-offense modern era. A few highlights:

| Event | Book avg | 2021–25 avg |
|-------|---------:|------------:|
| Home Run | 1.942 | 1.90 |
| Single | 1.025 | 0.96 |
| Non-Intentional Walk | 0.849 | 0.81 |
| Stolen Base | 0.792 | 0.70 |
| Out (batted ball) | 0.240 | 0.21 |
| Strikeout | 0.207 | 0.19 |
| Caught Stealing | 0.164 | 0.12 |

Sacrifice bunts have collapsed in volume (the book had ~7,900 over four years;
2021–25 has far fewer per season) since the universal DH arrived in 2022.
