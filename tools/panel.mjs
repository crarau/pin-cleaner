// Drive the on-page panel: node tools/panel.mjs open | toggle <hideAds|hideVideo|hideAI> | color <name> | aspect <name> | shot <file>
import { chromium } from 'playwright-core';
const [cmd, arg] = process.argv.slice(2);
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find(p => p.url().includes('pinterest'));
const panel = page.locator('#pin-cleaner-panel');
const ensureOpen = async () => { if (await panel.locator('.pill').count()) { await panel.locator('.pill').click(); await page.waitForTimeout(300); } };
if (cmd === 'open') await ensureOpen();
if (cmd === 'toggle') { await ensureOpen(); await panel.locator(`input[data-key="${arg}"]`).click(); }
if (cmd === 'color') { await ensureOpen(); await panel.locator(`[data-color="${arg}"]`).click(); }
if (cmd === 'aspect') { await ensureOpen(); await panel.locator(`[data-aspect="${arg}"]`).click(); }
if (cmd === 'clear') { await ensureOpen(); for (const a of ['clear-colors', 'clear-aspects']) if (await panel.locator(`[data-act="${a}"]`).innerText()) await panel.locator(`[data-act="${a}"]`).click(); }
if (cmd === 'shot') await page.screenshot({ path: arg });
await page.waitForTimeout(400);
console.log(cmd, arg || '', await panel.evaluate(h => h.shadowRoot.textContent.replace(/\s+/g, ' ').trim()));
await browser.close();
