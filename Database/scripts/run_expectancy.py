#!/usr/bin/env python3
"""
Run Expectancy by the 24 base/out states  --  Tom Tango, "The Book", Table 1.

Method (the standard Retrosheet recipe, e.g. Marchi/Albert "Analyzing Baseball
Data with R"):
  * For every play we know the base/out state at the START of the play and the
    total runs the batting team scored from that point until the end of the
    half-inning ("runs to end of inning", RUNS.ROI).
  * RUNS.ROI = (runs at start of inning + runs scored in the whole inning)
               - (runs already scored before this play)
  * We keep only innings that ended with exactly 3 outs (drops walk-off and
    game-ending partial innings, which would bias the late-inning states).
  * Run Expectancy for a state = mean(RUNS.ROI) over every plate appearance
    that BEGAN in that state.

Input : out/events_<year>.csv  (produced by cwevent), out/team_league_all.csv
Output: out/re_matrix_<year>.csv       human-readable 8x3 matrix per season
        out/re_dataset.json            additive aggregates for the React app
"""
import csv, glob, json, os, re
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "out")

# ---- base-state labels in Tom Tango's row order -------------------------------
# bit0 = runner on 1st, bit1 = on 2nd, bit2 = on 3rd
BASE_LABELS = {
    0: "_ _ _", 1: "1B _ _", 2: "_ 2B _", 4: "_ _ 3B",
    3: "1B 2B _", 5: "1B _ 3B", 6: "_ 2B 3B", 7: "1B 2B 3B",
}
BASE_ORDER = [0, 1, 2, 4, 3, 5, 6, 7]  # display order matching the book


def load_team_league():
    m = {}
    with open(os.path.join(OUT, "team_league_all.csv")) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            season, team, lg = line.split(",")
            m[(int(season), team)] = lg
    return m


def scored(dest):
    try:
        return 1 if int(dest) >= 4 else 0
    except ValueError:
        return 0


def process_season(path, season, groups, overall_by_season):
    """Aggregate one season's events into groups[(season,team)] and overall."""
    rows = []
    inn_runs_start, inn_runs_total, inn_outs_total = {}, defaultdict(int), defaultdict(int)

    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            gid = row["game_id"]
            half = (gid, row["inning"], row["bat_home"])
            runs_before = int(row["vis_score"]) + int(row["home_score"])
            runs_play = (scored(row["bat_dest"]) + scored(row["r1_dest"])
                         + scored(row["r2_dest"]) + scored(row["r3_dest"]))
            if half not in inn_runs_start:
                inn_runs_start[half] = runs_before
            inn_runs_total[half] += runs_play
            inn_outs_total[half] += int(row["event_outs"])

            base = (1 if row["r1"] else 0) | (2 if row["r2"] else 0) | (4 if row["r3"] else 0)
            team = gid[:3] if row["bat_home"] == "1" else row["vis_team"]
            rows.append((half, runs_before, base, int(row["outs"]),
                         row["bat_event_fl"] == "T", team))

    used = set()
    for half, runs_before, base, outs, is_pa, team in rows:
        if inn_outs_total[half] != 3 or not is_pa:
            continue
        runs_roi = (inn_runs_start[half] + inn_runs_total[half]) - runs_before
        cell = (base, outs)
        groups[(season, team)][cell][0] += 1
        groups[(season, team)][cell][1] += runs_roi
        overall_by_season[season][cell][0] += 1
        overall_by_season[season][cell][1] += runs_roi
        used.add(half)
    return len(used)


def write_matrix(season, overall):
    path = os.path.join(OUT, f"re_matrix_{season}.csv")
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["bases", "0 outs", "1 out", "2 outs", "n_0", "n_1", "n_2"])
        for base in BASE_ORDER:
            vals, ns = [], []
            for outs in (0, 1, 2):
                c, s = overall[(base, outs)]
                vals.append(f"{s / c:.3f}" if c else "")
                ns.append(c)
            w.writerow([BASE_LABELS[base]] + vals + ns)
    return path


def main():
    team_league = load_team_league()
    groups = defaultdict(lambda: defaultdict(lambda: [0, 0.0]))
    overall_by_season = defaultdict(lambda: defaultdict(lambda: [0, 0.0]))

    files = sorted(glob.glob(os.path.join(OUT, "events_*.csv")))
    seasons = []
    for path in files:
        season = int(re.search(r"events_(\d{4})\.csv", os.path.basename(path)).group(1))
        seasons.append(season)
        n = process_season(path, season, groups, overall_by_season)
        c, s = overall_by_season[season][(0, 0)]
        print(f"{season}: {n:,} complete innings, overall RE (empty/0 out) = {s / c:.3f}")
    seasons.sort()

    # human-readable matrices
    for season in seasons:
        write_matrix(season, overall_by_season[season])

    # additive JSON dataset for the React app
    group_list = []
    for (season, team) in sorted(groups):
        cells = []
        for base in BASE_ORDER:
            for outs in (0, 1, 2):
                c, s = groups[(season, team)][(base, outs)]
                cells.append({"base": base, "outs": outs,
                              "count": c, "sumRuns": round(s, 4)})
        group_list.append({"season": season, "team": team,
                           "league": team_league.get((season, team), "?"),
                           "cells": cells})

    dataset = {
        "meta": {
            "title": "Run Expectancy by the 24 Base/Out States",
            "source": "Retrosheet event files parsed with Chadwick cwevent, computed locally",
            "method": ("mean runs scored to end of inning, per plate appearance; "
                       "complete (3-out) innings only"),
            "seasons": seasons,
            "baseLabels": {str(k): v for k, v in BASE_LABELS.items()},
            "baseOrder": BASE_ORDER,
        },
        "groups": group_list,
    }
    with open(os.path.join(OUT, "re_dataset.json"), "w") as f:
        json.dump(dataset, f, separators=(",", ":"))

    print(f"\nWrote re_dataset.json: {len(group_list)} (season,team) groups "
          f"across seasons {seasons}")
    # show the most recent season's matrix as a sanity check
    latest = seasons[-1]
    ov = overall_by_season[latest]
    print(f"\n{latest} matrix:")
    print(f"{'bases':<9}{'0 out':>8}{'1 out':>8}{'2 out':>8}")
    for base in BASE_ORDER:
        line = f"{BASE_LABELS[base]:<9}"
        for outs in (0, 1, 2):
            c, s = ov[(base, outs)]
            line += f"{s / c:>8.3f}"
        print(line)


if __name__ == "__main__":
    main()
