#!/usr/bin/env python3
"""
Runs To End Of Inning, By Event  --  Tom Tango, "The Book", Table 2.

Same "runs to end of inning" (RUNS.ROI) value used for Table 1, but grouped by
the TYPE OF EVENT instead of the base/out state -- and, unlike Table 1, every
event is counted (not just plate appearances), so steals, wild pitches, balks,
pickoffs, etc. each get their own row.

  RUNS.ROI = (runs at inning start + runs scored in the whole inning)
             - (runs already scored before this event)
  Average runs for an event type = mean(RUNS.ROI) over every occurrence of it,
  in complete (3-out) innings only.

Input : out/events_<year>.csv (must include event_cd, sh_fl, bunt_fl),
        out/team_league_all.csv
Output: out/re_by_event_<year>.csv     human-readable, sorted like the book
        out/event_dataset.json         additive aggregates for the React app
"""
import csv, glob, json, os, re
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "out")

# Retrosheet EVENT_CD -> our category key. Outs (cd 2) are split further below
# using the sacrifice-hit and bunt flags.
EVENT_CD = {
    23: "HR", 22: "3B", 21: "2B", 20: "1B",
    19: "FC", 18: "RBOE", 17: "INT", 16: "HBP",
    15: "IBB", 14: "NIBB", 13: "FLE", 11: "BK",
    10: "PB", 9: "WP", 8: "PK", 7: "PK",
    6: "CS", 5: "DI", 4: "SB", 3: "K",
}

# display order + labels for the table (book order: highest avg first)
CATS = [
    ("HR", "Home Run"), ("3B", "Triple"), ("2B", "Double"), ("RBOE", "Error"),
    ("INT", "Interference"), ("SAC", "Sac Bunt"), ("PB", "Passed Ball"),
    ("1B", "Single"), ("WP", "Wild Pitch"), ("HBP", "Hit by Pitch"),
    ("BK", "Balk"), ("NIBB", "Non-Intentional Walk"), ("IBB", "Intentional Walk"),
    ("SB", "Stolen Base"), ("DI", "Defensive Indifference"), ("BUNT", "Bunt"),
    ("PK", "Pickoff"), ("OUT", "Out (on Batted Ball)"), ("K", "Strikeout"),
    ("CS", "Caught Stealing"),
    # not in the book's table but kept so totals reconcile honestly:
    ("FC", "Fielder's Choice"), ("FLE", "Foul Error"), ("OTHER", "Other"),
]
LABELS = dict(CATS)
CAT_ORDER = [k for k, _ in CATS]


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


def category(row):
    cd = int(row["event_cd"])
    if cd == 2:  # generic out -> sac bunt / bunt / batted-ball out
        if row["sh_fl"] == "T":
            return "SAC"
        if row["bunt_fl"] == "T":
            return "BUNT"
        return "OUT"
    return EVENT_CD.get(cd, "OTHER")


def process_season(path, season, groups):
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

            team = gid[:3] if row["bat_home"] == "1" else row["vis_team"]
            rows.append((half, runs_before, category(row), team))

    for half, runs_before, cat, team in rows:
        if inn_outs_total[half] != 3:
            continue
        runs_roi = (inn_runs_start[half] + inn_runs_total[half]) - runs_before
        g = groups[(season, team)][cat]
        g[0] += 1
        g[1] += runs_roi


def write_season_table(season, totals):
    path = os.path.join(OUT, f"re_by_event_{season}.csv")
    rows = []
    for cat in CAT_ORDER:
        c, s = totals.get(cat, (0, 0.0))
        if c == 0:
            continue
        rows.append((LABELS[cat], cat, c, round(s, 1), s / c))
    rows.sort(key=lambda r: r[4], reverse=True)  # by average, descending
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Event", "code", "N", "Runs to End of Inning", "Average Runs"])
        for label, cat, c, s, avg in rows:
            w.writerow([label, cat, c, s, f"{avg:.3f}"])
    return path, rows


def main():
    team_league = load_team_league()
    groups = defaultdict(lambda: defaultdict(lambda: [0, 0.0]))

    files = sorted(glob.glob(os.path.join(OUT, "events_*.csv")))
    seasons = []
    for path in files:
        season = int(re.search(r"events_(\d{4})\.csv", os.path.basename(path)).group(1))
        seasons.append(season)
        process_season(path, season, groups)
    seasons.sort()

    # per-season human-readable tables; collect totals for the latest season
    season_totals = defaultdict(lambda: defaultdict(lambda: [0, 0.0]))
    for (season, team), cats in groups.items():
        for cat, (c, s) in cats.items():
            season_totals[season][cat][0] += c
            season_totals[season][cat][1] += s
    for season in seasons:
        write_season_table(season, {k: tuple(v) for k, v in season_totals[season].items()})

    # additive JSON dataset for the React app
    group_list = []
    for (season, team) in sorted(groups):
        cells = {cat: {"count": c, "sumRuns": round(s, 4)}
                 for cat, (c, s) in groups[(season, team)].items()}
        group_list.append({"season": season, "team": team,
                           "league": team_league.get((season, team), "?"),
                           "cells": cells})
    dataset = {
        "meta": {
            "title": "Runs To End Of Inning, By Event",
            "source": "Retrosheet event files parsed with Chadwick cwevent, computed locally",
            "method": ("mean runs scored to end of inning, over every occurrence of "
                       "the event; complete (3-out) innings only"),
            "seasons": seasons,
            "categories": CATS,
        },
        "groups": group_list,
    }
    with open(os.path.join(OUT, "event_dataset.json"), "w") as f:
        json.dump(dataset, f, separators=(",", ":"))

    # console summary: most recent season, book-style
    latest = seasons[-1]
    _, rows = write_season_table(
        latest, {k: tuple(v) for k, v in season_totals[latest].items()})
    print(f"Runs to End of Inning, By Event -- {latest}\n")
    print(f"{'Event':<22}{'code':<7}{'N':>8}{'RunsToEnd':>12}{'Avg':>8}")
    print("-" * 57)
    for label, cat, c, s, avg in rows:
        print(f"{label:<22}{cat:<7}{c:>8}{s:>12.1f}{avg:>8.3f}")
    print(f"\nWrote event_dataset.json: {len(group_list)} (season,team) groups, "
          f"seasons {seasons}")


if __name__ == "__main__":
    main()
