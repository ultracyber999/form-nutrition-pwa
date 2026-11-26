/* eslint-disable no-undef */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(new URL('../apps/web/package.json', import.meta.url))('playwright');
const root = new URL('..', import.meta.url).pathname;
const outDir = path.join(root, 'docs/evidence/design-states-rc4');
fs.mkdirSync(outDir, { recursive: true });
const base = 'http://localhost:4173';
const browser = await chromium.launch({ executablePath: '/home/ubuntu/.local/bin/google-chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await context.newPage();
async function inject() { await page.addScriptTag({ url: '/test-utils.js' }); await page.waitForFunction(() => window.formTest); }
async function seedBase() {
  await page.evaluate(async () => {
    await window.formTest.ensureBase();
    const foods = await window.formTest.repo.searchFoods('עוף');
    if ((await window.formTest.repo.listFoodEntries()).length === 0) await window.formTest.repo.addFoodEntry({ localDate: '2026-11-26', mealType: 'lunch', foodVersionId: foods[0].id, quantity: 180, unit: 'g' });
    if ((await window.formTest.repo.listMeasurements()).length === 0) {
      for (let day = 0; day < 7; day += 1) {
        const date = new Date(Date.UTC(2026, 10, 20 + day)).toISOString().slice(0, 10);
        await window.formTest.repo.saveMeasurement({ type: 'weight', value: 91.8 - day * 0.18, unit: 'kg', measuredAt: `${date}T06:30:00+02:00`, localDate: date, source: 'manual', externalSampleId: null });
      }
    }
  });
}
async function shot(name, theme, route = '/today') {
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  await page.evaluate((value) => localStorage.setItem('form.theme', value), theme);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, `${name}-${theme}.png`) });
}
await page.goto(`${base}/today`, { waitUntil: 'networkidle' });
await inject();
await seedBase();
await shot('populated-today', 'dark');
await shot('populated-today', 'light');
await page.goto(`${base}/nutrition/2026-11-26?add=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(outDir, 'quick-add-populated-dark.png') });
await page.goto(`${base}/today`, { waitUntil: 'networkidle' });
await inject();
await page.evaluate(() => window.formTest.repo.clearLocalData());
await page.reload({ waitUntil: 'networkidle' });
await inject();
await page.evaluate(() => window.formTest.ensureBase());
await shot('empty-today', 'dark');
await inject();
await page.evaluate(() => window.formTest.repo.addManualEntry({ localDate: '2026-11-26', mealType: 'other', label: 'ארוחה משוערת חלקית', nutrients: { kcal: 300, proteinG: null, carbG: null, fatG: null, fiberG: null } }));
await shot('incomplete-today', 'dark');
await inject();
await page.evaluate(() => window.formTest.repo.addManualEntry({ localDate: '2026-11-26', mealType: 'other', label: 'ארוחה גדולה לבדיקת חריגה', nutrients: { kcal: 2500, proteinG: 40, carbG: 250, fatG: 90, fiberG: 10 } }));
await shot('over-budget-today', 'dark');
await browser.close();
console.log('captured rc4 design states');
