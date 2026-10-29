// Capture the 1280x800 Chrome Web Store screenshots from the dev browser.
import { chromium } from 'playwright-core';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.setViewportSize({ width: 1280, height: 800 });
const panel = page.locator('#pin-cleaner-panel');
async function openPanel() { if (await panel.locator('.pill').count()) { await panel.locator('.pill').click(); await page.waitForTimeout(500); } }
async function setSettings(s) {
  // Settings live in chrome.storage.sync; set them from the extension's library page.
  const lib = await ctx.newPage();
  await lib.goto('chrome-extension://lmofilnijklceoldcbkcemimdhimmbfe/library.html');
  await lib.evaluate(async s => { const cur = (await chrome.storage.sync.get('settings')).settings || {}; await chrome.storage.sync.set({ settings: { ...cur, ...s } }); }, s);
  await lib.close();
}
async function go(url) { await page.goto(url, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('[data-grid-item]', { timeout: 20000 }); await page.waitForTimeout(3500); await page.waitForFunction(() => [...document.querySelectorAll("[data-grid-item] img")].filter(i => i.getBoundingClientRect().top < 800).every(i => i.complete && i.naturalWidth > 0), null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(1500); }

// 1. Home feed, ads gone, panel open
await setSettings({ hideAds: true, hideVideo: true, hideAI: true, colors: [], aspects: [], panelOpen: true, folder: 'Moodboard' });
await go('https://ca.pinterest.com/search/pins/?q=scandinavian%20interior');
await page.screenshot({ path: 'store/1-clean.png' });

// 2. Color and shape filter
await setSettings({ colors: ['blue'], aspects: ['landscape'] });
await go('https://ca.pinterest.com/search/pins/?q=blue%20ocean%20landscape%20photography');
await page.screenshot({ path: 'store/2-filter.png' });

// 3. Picking: hover a pin, picked pins outlined
await setSettings({ colors: [], aspects: [], panelOpen: false });
await go('https://ca.pinterest.com/search/pins/?q=interior%20design');
await page.locator('[data-grid-item]:not([data-pc-hidden])').nth(4).hover();
await page.waitForTimeout(600);
await page.screenshot({ path: 'store/3-pick.png' });

// 4. Library
await page.goto('chrome-extension://lmofilnijklceoldcbkcemimdhimmbfe/library.html');
await page.waitForSelector('.card'); await page.waitForTimeout(2500);
await page.screenshot({ path: 'store/4-library.png' });
await page.close();
await browser.close();
