# Database — Retrosheet Play-By-Play & Run Expectancy

This folder holds the data side of *The Book, Recreated*.

The source of truth for non-frontend code is now:

```text
Database/retrosheet_pipeline.ipynb
```

That notebook is both a walkthrough and the executable pipeline. It explains the
Retrosheet inputs, shows the aggregation steps, renders inline sanity-check
charts from the generated JSON, writes datasets to `Database/out/`, and copies
the site-facing JSON files into `site/src/data/`.

## Dependencies

- Chadwick: `brew install chadwick` for `cwevent`
- Python 3
- Notebook walkthrough libraries:

  ```bash
  python3 -m pip install --user "matplotlib<3.8" pandas ipywidgets
  ```

- A Jupyter-capable editor or notebook runner

## Use The Notebook

For quick exploration, open `Database/retrosheet_pipeline.ipynb` and run all
cells with:

```python
RUN_PIPELINE = False
```

This loads the existing JSON in `Database/out/` and renders the walkthrough
tables and charts under the cells.

To rebuild data:

1. Open `Database/retrosheet_pipeline.ipynb`.
2. Confirm `START_YEAR`, `END_YEAR`, and the other configuration values in the
   first code cell.
3. In the rebuild cell, set:

   ```python
   RUN_PIPELINE = True
   ```

4. Run all cells.

The notebook reuses existing `raw/<year>/` Retrosheet downloads unless
`FORCE_DOWNLOAD` is `True`. It regenerates intermediate `out/events_<year>.csv`
files by default, computes the JSON outputs, syncs `re_dataset.json` and
`event_states.json` to the React site, and then removes the intermediate event
CSVs when `REMOVE_INTERMEDIATE_EVENTS` is `True`.

## Outputs

```text
raw/<year>/                 extracted Retrosheet event + roster files
out/team_league_all.csv     team → league map per season
out/re_matrix_<year>.csv    human-readable Table 1 matrix per season
out/re_by_event_<year>.csv  human-readable Table 2 event table per season
out/re_dataset.json         additive Table 1 dataset for the site
out/event_dataset.json      standalone additive Table 2 dataset
out/event_states.json       event/state dataset for Tables 2-6 on the site
```

## Adding A Table

Add the data computation to `retrosheet_pipeline.ipynb`, write the generated
dataset to `Database/out/`, and add at least one notebook visualization or
summary table so the numbers can be inspected before touching React. Copy any
site-consumed JSON into `site/src/data/`. Then add the React table under
`site/src/tables/` and register it in `site/src/tables/registry.js`.

Keep the notebook as the only backend/data implementation. Avoid adding new
standalone `.py` or `.sh` pipeline files unless the project intentionally changes
that convention.
