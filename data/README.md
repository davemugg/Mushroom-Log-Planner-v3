# Tile-size study (up to 7×7)

Which repeating-tile size earns the most gold per square of land, using Mushroom Log Planner 2's own optimizer.

## How it was run

- `tile-size-study.mjs` loads the model code straight from `../index.html`, so results match the page exactly.
- Every tile size from 2×2 to 7×7 (36 sizes), **20 independent runs per size**, **3 seconds per run** (about what the page spends refining a tile on Normal). 1,440 runs in total.
- Two settings, both from the page's repeating-tile defaults (Oak, Maple and Pine allowed; walkways on; regular Tapper, tapping counted; no profession; no moss; no rain; no mushroom target):
  - **default**: walkways must run off the tile and join the next copy, in at least one direction.
  - **connected**: "Make all walkways one connected network across every tile" is on, so walkways must join up both across and down.
- Earnings are per tile with copies on every side, divided by the tile's area to compare sizes fairly.
- Every result was checked: no run left an unreachable log or broke a tree-spacing rule.

To repeat it: `node tile-size-study.mjs --runs 20 --budget 3000 --max 7`

## Results

### Default walkways

| Rank | Size | Best g/square/day | Mean (20 runs) | Best g/tile/day | Logs | Won the run |
|---|---|---|---|---|---|---|
| 1 | **3×4** | **79.24** | 79.24 | 951 | 6 | 17 of 20 |
| 2 | 4×3 | 79.24 | 79.24 | 951 | 6 | 2 of 20 |
| 3 | 6×4 | 79.24 | 77.85 | 1,902 | 12 | 1 of 20 |
| 4 | 6×5 | 78.17 | 75.92 | 2,345 | 14 | 0 |
| 5 | 6×6 | 77.99 | 76.45 | 2,808 | 17 | 0 |

**Best: 3×4 (or the same layout turned, 4×3), 79.2g per square per day.** Every one of its 20 runs found the same layout. The 6×4 winner is just two copies of it, and no larger tile beat it in any run. That points to 3×4 being the true best at this size limit. 3×4, 4×3 and 6×4 split the wins only because they find the same value, so read their win counts together.

The 3×4 tile (`.` walkway, `L` log, `P` Pine):

```
. L L
. P L
. L L
. L P
```

Each copy has 6 logs, 2 tapped Pines and one walkway column. Placed side by side, the walkway columns form a path every 3 squares, and every log touches a walkway, either in its own tile or the next copy's.

### Connected walkways (one network)

| Rank | Size | Best g/square/day | Mean (20 runs) | Best g/tile/day | Logs | Won the run |
|---|---|---|---|---|---|---|
| 1 | **6×7** | **69.45** | 68.67 | 2,917 | 18 | 7 of 20 |
| 2 | 7×6 | 69.45 | 68.45 | 2,917 | 18 | 7 of 20 |
| 3 | **6×6** | **69.45** | 68.60 | 2,500 | 15 | 5 of 20 |
| 4 | 7×7 | 68.88 | 66.96 | 3,375 | 20 | 1 of 20 |
| 5 | 5×6 | 67.19 | 65.39 | 2,016 | 13 | 0 |

**Best: 6×7 and 6×6 are tied at about 69.4g per square per day.** Their best results differ by 0.001g, well inside the run-to-run spread. The 6×6 tile is the easier one to use since it's square. Requiring one connected network costs about 12% compared with the default walkways, because the paths have to cross in both directions.

The 6×6 tile:

```
. P L . L P
. L L L L L
. P L P L P
. . . . . .
. P L . L P
. L L . L L
```

## Caveats

- These are for the settings above. Mystic trees, Heavy Tappers, moss, console mode or a mushroom target will change the answer.
- A larger tile can always copy a smaller one, so in theory its best is never lower (for example, 6×4 matches 3×4). Larger tiles score lower here only because 3 seconds isn't enough to search their bigger layouts fully. The mean and worst columns show this.
- "Won the run" counts, for each run number, which size scored highest per square. That's roughly what the page's "Find the best tile size" option does.

## Files

- `results/runs.csv`: all 1,440 runs, one row each. Includes gold per tile and per square, the mushroom and tapping split, logs, trees by type, walkway squares, checks, and the layout (rows separated by `/`).
- `results/summary.csv`: one row per setting and size, with best, mean, standard deviation and worst gold per square, rank by best and by mean, win count, and the best layout.
- `results/best-layouts.json`: the best layout and its figures for every size and setting, with the run settings and the layout legend.
- `results-log.txt`: the run's progress log.
- `tile-size-study.mjs`: the script that produced all of this.
