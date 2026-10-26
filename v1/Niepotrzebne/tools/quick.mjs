// Quick layout check at a given viewport: title, teams modal, options, board, difficulty, question.
// node quick.mjs <outDir> <width> <height>
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const { chromium } = require('playwright-core');

const [out = 'quick', w = '1024', h = '768'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
page.on('console', m => m.type() === 'error' && logs.push(`[console] ${m.text()}`));
await page.goto('http://127.0.0.1:8743/', { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__chucuchu);
const wait = ms => page.waitForTimeout(ms);
const shot = n => page.screenshot({ path: `${out}/${w}x${h}-${n}.png` });
await wait(1200);
await shot('1-title');
await page.click('[data-act="teams"]');
await wait(500);
await shot('2-teams');
await page.keyboard.press('Escape');
await page.click('[data-act="options"]');
await wait(500);
await shot('3-options');
await page.keyboard.press('Escape');
await page.keyboard.press('Space');
await wait(2800);
await shot('4-board');
await page.keyboard.press('Space');
await wait(600);
await page.keyboard.press('9');
await wait(700);
await shot('5-question');
console.log(logs.join('\n') || 'no errors');
await browser.close();
