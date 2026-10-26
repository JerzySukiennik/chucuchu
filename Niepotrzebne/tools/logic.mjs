// Logic checks in headless Chrome: undo, save/resume, semáforo skip, otra vez retry.
import { createRequire } from 'node:module';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const { chromium } = require('playwright-core');

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:8743/', { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__chucuchu);
const wait = ms => page.waitForTimeout(ms);
const key = async k => { await page.keyboard.press(k); await wait(150); };
const st = () => page.evaluate(() => ({ phase: __chucuchu.phase, pos: __chucuchu.S?.teams.map(t => t.pos), turn: __chucuchu.S?.turn, round: __chucuchu.S?.round, skip: __chucuchu.S?.teams.map(t => t.skip), items: __chucuchu.S?.teams.map(t => t.items.join('+')) }));
const ok = (cond, msg) => console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`);
async function answer(correct) {
  const t = await page.evaluate(() => { const t = __chucuchu.turn; return { abcd: t.q.abcd, idx: t.opts ? t.opts.findIndex(o => o.ok && !o.out && !o.picked) : -1, wrong: t.opts ? t.opts.findIndex(o => !o.ok && !o.out && !o.picked) : -1 }; });
  if (t.abcd) await key('abcd'[correct ? t.idx : t.wrong]);
  else { await key('Space'); await wait(200); await key(correct ? 't' : 'n'); }
  await wait(300);
}
async function waitPhase(p, ms = 9000) { await page.waitForFunction(p => __chucuchu.phase === p, p, { timeout: ms }); }

await wait(800);
await key('Space');
await wait(2600);
await page.evaluate(() => { __chucuchu.S.powerups = true; });
await key('Space'); await waitPhase('difficulty');
await key('4'); await waitPhase('question');
await answer(true);
await key('Space');
await page.waitForFunction(() => ['board', 'reward'].includes(__chucuchu.phase), null, { timeout: 9000 });
if ((await st()).phase === 'reward') await key('Space');
let s = await st();
ok(s.pos[0] === 4 && s.turn === 1, `turn 1 correct d=4 -> pos ${s.pos[0]}, next turn ${s.turn}`);

await key('m'); await wait(300);
await page.click('[data-act="undo"]'); await wait(600);
s = await st();
ok(s.pos[0] === 0 && s.turn === 0 && s.phase === 'board', `undo -> pos ${s.pos[0]}, turn ${s.turn}, ${s.phase}`);

await page.evaluate(() => { const S = __chucuchu.S; S.teams[0].items = ['semaforo', 'otra']; __chucuchu.renderHud(); });
await key('Space'); await waitPhase('powerup');
await key('1'); await waitPhase('target');
await key('2');
await waitPhase('difficulty');
s = await st();
ok(s.skip[1] === 1, `semáforo on team 2 -> skip ${s.skip[1]}`);
await key('3'); await waitPhase('question');
await answer(false);
await key('Space');
await waitPhase('board', 9000);
s = await st();
ok(s.turn === 1 && s.pos[0] === 0, `wrong answer -> pos stays ${s.pos[0]}, turn ${s.turn}`);

await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__chucuchu);
await wait(800);
const hasResume = await page.$('[data-act="resume"]');
ok(!!hasResume, 'resume button after reload');
await page.click('[data-act="resume"]');
await wait(2500);
s = await st();
ok(s.turn === 1 && s.skip[1] === 1 && s.items[0] === 'otra', `resumed turn ${s.turn}, skip ${s.skip[1]}, items[0] ${s.items[0]}`);

await key('Space'); await waitPhase('skip');
ok(true, 'team 2 sees semáforo skip screen');
await key('Space'); await waitPhase('board');
s = await st();
ok(s.turn === 2 && s.skip[1] === 0, `skip consumed -> turn ${s.turn}, skip ${s.skip[1]}`);

await page.evaluate(() => { const S = __chucuchu.S; S.turn = 0; S.teams[0].items = ['otra']; __chucuchu.renderHud(); });
await key('Space'); await waitPhase('powerup');
await key('1'); await waitPhase('difficulty');
await key('2'); await waitPhase('question');
const before = await page.evaluate(() => __chucuchu.turn.q.id);
await answer(false);
const mid = await page.evaluate(() => ({ done: __chucuchu.turn.done, retried: __chucuchu.turn.retried, id: __chucuchu.turn.q.id }));
ok(!mid.done && mid.retried, `otra vez -> second try (done ${mid.done}, retried ${mid.retried}, same q ${mid.id === before})`);
await answer(true);
await key('Space');
await page.waitForFunction(() => ['board', 'reward'].includes(__chucuchu.phase), null, { timeout: 9000 });
s = await st();
ok(s.pos[0] === 2, `second try correct -> pos ${s.pos[0]}`);

console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
await browser.close();
