# Database — Retrosheet play-by-play & run expectancy

This folder downloads historic MLB play-by-play data from **Retrosheet** and
computes run expectancy from it. It's the data foundation for the rest of the
*The Book* recreation.

## A note on the "Retrosheet API"

Retrosheet does **not** publish a REST API. It distributes one ZIP of
play-by-play *event files* per season at
`https://www.retrosheet.org/events/<YEAR>eve.zip`. Each ZIP contains one
`.EVA` (American League home games) or `.EVN` (National League home games)
file per team, in Retrosheet's compact event format. We parse those with
**Chadwick** (`cwevent`), the standard open-source Retrosheet toolkit.

## What's here

```
raw/<year>/            extracted Retrosheet event + roster files (per season)
out/events_<year>.csv  flat play-by-play, one row per event (from cwevent)
out/team_league_all.csv team -> league map per season (derived from .EVA/.EVN)
out/re_matrix_<year>.csv human-readable 8x3 run-expectancy matrix per season
out/re_dataset.json    compact additive aggregates consumed by the React app
scripts/run_expectancy.py  the computation
```

Seasons currently loaded: **2021–2025**.

## How to reproduce from scratch

```bash
# 1. install the Chadwick parser (one time)
brew install chadwick

# 2. download + extract a season (example: 2025)
mkdir -p raw/2025 && cd raw/2025
curl -O https://www.retrosheet.org/events/2025eve.zip
unzip -o 2025eve.zip && cd ../..

# 3. convert events to CSV (field numbers come from `cwevent -d`)
cwevent -y 2025 -f 0,1,2,3,4,8,9,26,27,28,35,40,58,59,60,61 \
  raw/2025/2025*.EVA raw/2025/2025*.EVN > out/events_2025.csv   # add a header row

# 4. compute the run-expectancy matrices + JSON dataset
python3 scripts/run_expectancy.py
```

(The header row and the team→league map are added by the same loop used to
build the current files; see the project history.)

## How run expectancy is calculated

The standard Retrosheet recipe (Marchi & Albert, *Analyzing Baseball Data with
R*):

1. For every play, record the **base/out state at the start** of the play and
   the runs already scored in the game.
2. Per half-inning, `runs to end of inning = (runs at inning start + runs
   scored in the whole inning) − runs already scored before this play`.
3. Keep only innings that ended with **exactly 3 outs** — this drops walk-off
   and game-ending partial innings that would otherwise bias the late-inning,
   runners-on states downward.
4. **Run expectancy of a state** = the mean of "runs to end of inning" over
   every *plate appearance* that began in that state.

Because the JSON stores `count` and `sumRuns` per (season, team, state), the
numbers are **additive**: the React app sums any selection of seasons/leagues/
teams and divides to get that selection's matrix — no recomputation needed.

## Results (sanity check)

Overall run expectancy = the bases-empty / 0-out value, which equals the
average runs scored per inning:

| Season | Overall RE (empty, 0 out) |
|-------:|--------------------------:|
| 2021 | 0.505 |
| 2022 | 0.473 |
| 2023 | 0.513 |
| 2024 | 0.484 |
| 2025 | 0.495 |

These are sensibly lower than the **0.555** in *The Book*'s Table 1 (1999–2002),
a much higher-offense era, and they track the real run environment year to year
(2022 was a notably low-offense season; scoring ticked up in 2023 after the rule
changes). The full 24-state matrices are monotonic exactly as expected — more
runners and fewer outs always raise the expectancy.
