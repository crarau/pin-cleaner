// Save every JSON body loaded by a pin page to shots/pin-<id>.json
import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('pinterest'));
for (const id of process.argv.slice(2)) {
  const bodies = [];
  const h = async r => { if (/resource|graphql/.test(r.url())) try { bodies.push(await r.text()); } catch {} };
  page.on('response', h);
  await page.goto(`https://ca.pinterest.com/pin/${id}/`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(5000);
  page.off('response', h);
  bodies.push(await page.content());
  writeFileSync(`shots/pin-${id}.json`, JSON.stringify(bodies));
}
await browser.close();
