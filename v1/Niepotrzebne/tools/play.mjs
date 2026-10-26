// Headless Chrome (real GPU via ANGLE/Metal) playthrough harness for Chucuchu.
// node play.mjs <outDir> [width] [height]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const { chromium } = require('playwright-core');

const [out = 'shots', w = '1280', h = '720'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
const url = process.env.URL || 'http://127.0.0.1:8743/';
await page.goto(url, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__chucuchu, null, { timeout: 20000 });
const wait = ms => page.waitForTimeout(ms);
const key = async k => { await page.keyboard.press(k); await wait(120); };
const shot = async name => { await page.screenshot({ path: `${out}/${name}.png` }); logs.push(`[shot] ${name}`); };
const state = () => page.evaluate(() => ({ phase: __chucuchu.phase, pos: __chucuchu.S?.teams.map(t => t.pos), items: __chucuchu.S?.teams.map(t => t.items.join('+')), round: __chucuchu.S?.round, turn: __chucuchu.S?.turn }));
const fps = () => page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
async function answer(correct = true) {
  const t = await page.evaluate(() => { const t = __chucuchu.turn; return { abcd: t.q.abcd, idx: t.opts ? t.opts.findIndex(o => o.ok && !o.out) : -1, wrong: t.opts ? t.opts.findIndex(o => !o.ok && !o.out) : -1 }; });
  if (t.abcd) await key('abcd'[correct ? t.idx : t.wrong]);
  else { await key('Space'); await wait(300); await key(correct ? 't' : 'n'); }
  await wait(500);
}

await wait(1500);
await shot('01-title');
logs.push('[fps title] ' + await fps());
await key('Space');
await wait(2600);
await shot('02-board');
logs.push('[fps board] ' + await fps());
const info = await page.evaluate(() => { const r = __chucuchu.world.stats(); return { calls: r.calls, tris: r.triangles }; });
logs.push('[render] ' + JSON.stringify(info));

await key('Space');
await wait(700);
await shot('03-difficulty');
await key('8');
await wait(700);
await shot('04-question');
await answer(true);
await shot('05-result');
await key('Space');
await wait(900);
await shot('06-moving');
await wait(3500);
logs.push('[state] ' + JSON.stringify(await state()));
if ((await state()).phase === 'reward') { await shot('06b-reward'); await key('Space'); await wait(800); }

await key('Space');
await wait(700);
await key('2');
await wait(700);
await shot('07-question2');
await answer(false);
await shot('08-wrong');
await key('Space');
await wait(1800);
logs.push('[state] ' + JSON.stringify(await state()));

await page.evaluate(() => { const S = __chucuchu.S; S.teams[S.turn].items.push('minigun', 'robo', 'escudo'); __chucuchu.world.setItems(S.turn, S.teams[S.turn].items); __chucuchu.renderHud(); });
await key('Space');
await wait(800);
await shot('09-powerups');
const mgIdx = await page.evaluate(() => __chucuchu.S.teams[__chucuchu.S.turn].items.indexOf('minigun'));
await key(String(mgIdx + 1));
await wait(900);
await shot('10-minigun-firing');
await wait(4000);
logs.push('[state after minigun] ' + JSON.stringify(await state()));
await shot('11-after-minigun');
if ((await state()).phase === 'difficulty') {
  await key('5');
  await wait(600);
  await answer(true);
  await key('Space');
  await wait(700);
  await shot('12-minigun-move');
  await wait(5000);
  logs.push('[state] ' + JSON.stringify(await state()));
  if ((await state()).phase === 'reward') { await shot('12b-reward'); await key('Space'); await wait(800); }
}

await page.evaluate(() => { const S = __chucuchu.S; S.teams[S.turn].items.push('robo'); __chucuchu.renderHud(); });
await key('Space');
await wait(700);
const roboIdx = await page.evaluate(() => __chucuchu.S.teams[__chucuchu.S.turn].items.indexOf('robo'));
await key(String(roboIdx + 1));
await wait(600);
await shot('13-target');
await key('1');
await wait(1200);
await shot('14-steal');
await wait(3500);
logs.push('[state after robo] ' + JSON.stringify(await state()));

await page.evaluate(() => { __chucuchu.S.round = __chucuchu.S.rounds; __chucuchu.S.turn = __chucuchu.S.teams.length - 1; });
await page.keyboard.press('m');
await wait(500);
await shot('15-menu');
await page.click('[data-act="endNow"]');
await wait(2500);
await shot('16-end');
logs.push('[fps end] ' + await fps());

console.log(logs.join('\n'));
await browser.close();
