// Render the toolbar icons (16/48/128) with the dev Chromium's canvas.
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';
mkdirSync('extension/icons', { recursive: true });
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = await browser.contexts()[0].newPage();
for (const size of [16, 48, 128]) {
  const data = await page.evaluate(s => {
    const c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
    g.fillStyle = '#e60023'; g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = s * 0.11; g.lineCap = 'round';
    g.beginPath(); g.arc(s / 2, s / 2, s * 0.26, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(s * 0.32, s * 0.68); g.lineTo(s * 0.68, s * 0.32); g.stroke();
    return c.toDataURL('image/png').split(',')[1];
  }, size);
  writeFileSync(`extension/icons/${size}.png`, Buffer.from(data, 'base64'));
}
await page.close(); await browser.close();
