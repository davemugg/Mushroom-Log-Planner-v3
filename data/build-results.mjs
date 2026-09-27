// Packs the tile-size study results into ../results.html (inside <script id="study-data">),
// so the page works offline and when published. Run after tile-size-study.mjs:
//   node build-results.mjs [--in results]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf('--in');
const IN = path.join(here, i > 0 ? process.argv[i + 1] : 'results');

function readCsv(file) {
  const [head, ...lines] = readFileSync(file, 'utf8').trim().split(/\r?\n/);
  const cols = head.split(',');
  return lines.map(l => Object.fromEntries(l.split(',').map((v, k) => [cols[k], v])));
}
const num = v => +v;
const runs = readCsv(path.join(IN, 'runs.csv'));
const summary = readCsv(path.join(IN, 'summary.csv'));
const best = JSON.parse(readFileSync(path.join(IN, 'best-layouts.json'), 'utf8'));

const scen = {};
for (const s of summary) {
  const key = `${s.w}x${s.h}`, b = best.best[s.scenario][key];
  (scen[s.scenario] ??= []).push({
    w: num(s.w), h: num(s.h), area: num(s.area),
    best: num(s.bestGoldSquare), mean: num(s.meanGoldSquare), sd: num(s.sdGoldSquare), worst: num(s.worstGoldSquare),
    bestTile: num(s.bestGoldTile), wins: num(s.wins), rankBest: num(s.rankByBest), rankMean: num(s.rankByMean),
    layout: s.bestLayout, logs: b.logs, oak: b.oak, maple: b.maple, pine: b.pine, walkway: b.walkway,
    mushGold: +b.mushGold.toFixed(2), tapGold: +b.tapGold.toFixed(2),
    runs: runs.filter(r => r.scenario === s.scenario && r.w === s.w && r.h === s.h)
      .sort((a, c) => a.run - c.run).map(r => +(+r.goldSquare).toFixed(3)),
  });
}
const data = {
  generated: best.generated, runsPerSize: best.runsPerSize, budgetMs: best.budgetMs, maxSize: best.maxSize,
  totalRuns: runs.length, settings: best.scenarios, scen,
};

const page = path.join(here, '..', 'results.html');
const html = readFileSync(page, 'utf8');
const re = /(<script id="study-data" type="application\/json">)[\s\S]*?(<\/script>)/;
if (!re.test(html)) throw new Error('study-data block not found in results.html');
writeFileSync(page, html.replace(re, (_, a, b) => a + JSON.stringify(data) + b));
console.log(`Packed ${runs.length} runs into results.html`);
