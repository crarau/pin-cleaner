// End-to-end: create a folder from the panel, pick three pins, open the library, export a ZIP.
import { chromium } from 'playwright-core';
import { readdirSync, statSync, mkdirSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { resolve } from 'path';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => p.url().includes('pinterest'));
page.on('dialog', d => d.accept('Moodboard'));
await page.goto('https://ca.pinterest.com/search/pins/?q=interior%20design', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-grid-item] .pc-pick', { timeout: 20000 });
await page.waitForTimeout(1500);
const panel = page.locator('#pin-cleaner-panel');
if (await panel.locator('.pill').count()) await panel.locator('.pill').click();
const folderBefore = await panel.locator('select[data-key="folder"]').evaluate(s => [...s.options].map(o => o.value));
await panel.locator('[data-act="new-folder"]').click();
await page.waitForTimeout(600);
const folderAfter = await panel.locator('select[data-key="folder"]').evaluate(s => ({ options: [...s.options].map(o => o.value), value: s.value }));
const items = page.locator('[data-grid-item]:not([data-pc-hidden])');
for (let i = 0; i < 3; i++) { const it = items.nth(i); await it.hover(); await it.locator('.pc-pick').click(); await page.waitForTimeout(400); }
const picked = await page.locator('.pc-picked').count();
const libPromise = ctx.waitForEvent('page');
await panel.locator('[data-act="library"]').click();
const lib = await libPromise;
await lib.waitForSelector('.card');
await lib.waitForTimeout(1500);
await lib.screenshot({ path: 'shots/library.png' });
const cards = await lib.locator('.card').count();
const folderNav = await lib.locator('#folders').innerText();
// Playwright redirects downloads of a CDP-connected browser to a temp folder it deletes; point them
// at a folder we can inspect instead.
const out = resolve('shots/downloads');
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
const cdp = await browser.newBrowserCDPSession();
await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: out, eventsEnabled: true });
await lib.locator('#export-zip').click();
await lib.waitForFunction(() => /Done/.test(document.getElementById('status').textContent), null, { timeout: 60000 });
const status = await lib.locator('#status').innerText();
await lib.waitForTimeout(1500);
const zips = readdirSync(out, { recursive: true }).filter(f => /\.zip$/.test(f));
let contents = [];
if (zips[0]) {
  const listing = execFileSync('unzip', ['-l', `${out}/${zips[0]}`]).toString();
  execFileSync('unzip', ['-o', '-q', `${out}/${zips[0]}`, '-d', `${out}/x`]);
  contents = readdirSync(`${out}/x`, { recursive: true }).filter(f => /\.jpg$/.test(f)).map(f => {
    const info = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', '-g', 'format', `${out}/x/${f}`]).toString();
    return f + ' ' + info.split('\n').slice(1).map(l => l.trim()).join(' ');
  });
}
console.log(JSON.stringify({ folderBefore, folderAfter, picked, cards, folderNav, status, zips, contents }, null, 1));
const widths = contents.map(c => +/pixelWidth: (\d+)/.exec(c)[1]);
if (!zips.length || contents.length !== 3) { console.error('FAIL: zip export'); process.exit(1); }
if (/reduced size|could not/.test(status)) { console.error('FAIL: export did not get every original'); process.exit(1); }
if (!widths.some(w => w > 736)) { console.error('FAIL: no image above the 736px grid size, originals not fetched'); process.exit(1); }
await browser.close();
