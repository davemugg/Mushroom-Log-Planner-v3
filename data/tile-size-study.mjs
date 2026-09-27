// Tile-size study for Mushroom Log Planner 2.
// Runs the page's own optimizer (loaded from ../index.html) many times for every repeating-tile size
// up to MAX x MAX, and saves every run plus a summary.
//
// Usage: node tile-size-study.mjs [--runs 20] [--budget 3000] [--max 7] [--workers 11] [--out results]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));

// Page defaults for "Repeating tile" mode, plus a connected-walkway variant
const BASE = {
  wrap: true, allowed: [2, 3, 4], saplings: false, access: true, continuous: false, side: 'any',
  walkOnly: false, orth: false, orthTrees: false, tap: true, heavy: false, tapperProf: false,
  moss: 0, rain: 0, target: -1, targetPct: 0.5,
};
const SCENARIOS = {
  default: { ...BASE },
  connected: { ...BASE, continuous: true, walkOnly: true },
};
const LETTER = ['.', 'L', 'O', 'M', 'P', 'Y', 'H', 's'];

function loadCore() {
  const html = readFileSync(path.join(here, '..', 'index.html'), 'utf8');
  const m = html.match(/<script id="core">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('core script not found in index.html');
  vm.runInThisContext(m[1] + '\nglobalThis.__core = { createOptimizer, analyze };');
  return globalThis.__core;
}

if (!isMainThread) {
  const { createOptimizer, analyze } = loadCore();
  parentPort.on('message', job => {
    if (!job) { process.exit(0); }
    const { scenario, w, h, run, budget } = job, o = SCENARIOS[scenario];
    const opt = createOptimizer(w, h, o, budget);
    let r; do r = opt.step(1000); while (!r.done);
    const A = analyze(w, h, o, r.grid);
    const rows = [];
    for (let y = 0; y < h; y++) rows.push([...r.grid.slice(y * w, y * w + w)].map(c => LETTER[c]).join(''));
    parentPort.postMessage({
      scenario, w, h, run, area: w * h,
      goldTile: A.gold, goldSquare: A.gold / (w * h), mushGold: A.mushGoldTotal, tapGold: A.tapGoldTotal,
      logs: A.logs, oak: A.trees[2], maple: A.trees[3], pine: A.trees[4], walkway: A.path,
      unreachableLogs: A.logsBlocked, invalid: A.invalid, score: r.score, layout: rows.join('/'),
    });
  });
} else {
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
  const RUNS = +arg('runs', 20), BUDGET = +arg('budget', 3000), MAX = +arg('max', 7);
  const WORKERS = +arg('workers', Math.max(1, os.cpus().length - 1));
  const OUT = path.join(here, arg('out', 'results'));
  mkdirSync(OUT, { recursive: true });

  const jobs = [];
  for (const scenario of Object.keys(SCENARIOS))
    for (let run = 1; run <= RUNS; run++)
      for (let w = 2; w <= MAX; w++) for (let h = 2; h <= MAX; h++) jobs.push({ scenario, w, h, run, budget: BUDGET });
  console.log(`${jobs.length} runs, ${BUDGET} ms each, ${WORKERS} workers, about ${Math.ceil(jobs.length * BUDGET / WORKERS / 60000)} min`);

  const results = [];
  const started = Date.now();
  await new Promise(resolve => {
    let next = 0, live = 0;
    for (let k = 0; k < WORKERS; k++) {
      const wk = new Worker(fileURLToPath(import.meta.url));
      live++;
      const feed = () => { wk.postMessage(next < jobs.length ? jobs[next++] : null); };
      wk.on('message', res => {
        results.push(res);
        if (results.length % 50 === 0 || results.length === jobs.length)
          console.log(`${results.length}/${jobs.length} done (${Math.round((Date.now() - started) / 1000)} s)`);
        feed();
      });
      wk.on('exit', () => { if (--live === 0) resolve(); });
      feed();
    }
  });

  results.sort((a, b) => a.scenario.localeCompare(b.scenario) || a.w - b.w || a.h - b.h || a.run - b.run);
  const csv = (rows, cols) => [cols.join(','), ...rows.map(r => cols.map(c => typeof r[c] === 'number' && !Number.isInteger(r[c]) ? r[c].toFixed(3) : r[c]).join(','))].join('\n') + '\n';

  // Every run
  writeFileSync(path.join(OUT, 'runs.csv'), csv(results,
    ['scenario', 'w', 'h', 'area', 'run', 'goldTile', 'goldSquare', 'mushGold', 'tapGold', 'logs', 'oak', 'maple', 'pine', 'walkway', 'unreachableLogs', 'invalid', 'layout']));

  // Per size summary + "wins": for each run number, which size earned the most per square (like one auto-size search)
  const summary = [], best = {};
  for (const scenario of Object.keys(SCENARIOS)) {
    const mine = results.filter(r => r.scenario === scenario);
    const wins = {};
    for (let run = 1; run <= RUNS; run++) {
      const top = mine.filter(r => r.run === run).reduce((a, b) => (b.goldSquare > a.goldSquare ? b : a));
      wins[`${top.w}x${top.h}`] = (wins[`${top.w}x${top.h}`] || 0) + 1;
    }
    const rows = [];
    for (let w = 2; w <= MAX; w++) for (let h = 2; h <= MAX; h++) {
      const rs = mine.filter(r => r.w === w && r.h === h), v = rs.map(r => r.goldSquare);
      const mean = v.reduce((a, b) => a + b, 0) / v.length;
      const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, v.length - 1));
      const top = rs.reduce((a, b) => (b.goldSquare > a.goldSquare ? b : a));
      rows.push({ scenario, w, h, area: w * h, runs: rs.length, bestGoldSquare: top.goldSquare, meanGoldSquare: mean, sdGoldSquare: sd,
        worstGoldSquare: Math.min(...v), bestGoldTile: top.goldTile, logsInBest: top.logs, wins: wins[`${w}x${h}`] || 0, bestLayout: top.layout });
      (best[scenario] ??= {})[`${w}x${h}`] = top;
    }
    rows.sort((a, b) => b.bestGoldSquare - a.bestGoldSquare).forEach((r, i) => { r.rankByBest = i + 1; });
    rows.slice().sort((a, b) => b.meanGoldSquare - a.meanGoldSquare).forEach((r, i) => { r.rankByMean = i + 1; });
    summary.push(...rows);
  }
  writeFileSync(path.join(OUT, 'summary.csv'), csv(summary,
    ['scenario', 'rankByBest', 'rankByMean', 'w', 'h', 'area', 'runs', 'bestGoldSquare', 'meanGoldSquare', 'sdGoldSquare', 'worstGoldSquare', 'bestGoldTile', 'logsInBest', 'wins', 'bestLayout']));
  writeFileSync(path.join(OUT, 'best-layouts.json'), JSON.stringify({
    generated: new Date().toISOString(), runsPerSize: RUNS, budgetMs: BUDGET, maxSize: MAX, scenarios: SCENARIOS,
    legend: { '.': 'walkway / empty', L: 'Mushroom Log', O: 'Oak', M: 'Maple', P: 'Pine', Y: 'Mystic', H: 'Mahogany', s: 'stunted sapling' },
    best,
  }, null, 2));
  console.log(`Saved to ${OUT} in ${Math.round((Date.now() - started) / 1000)} s`);
}
