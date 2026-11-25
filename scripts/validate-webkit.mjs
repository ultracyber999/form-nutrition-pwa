/* eslint-disable no-undef */
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { webkit } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');

const root = new URL('..', import.meta.url).pathname;
const port = Number(process.env.FORM_WEBKIT_PORT || 4373);
const base = `http://localhost:${port}`;
const date = '2026-11-26';
const outDir = `${root}docs/evidence/webkit-visual-matrix`;
fs.mkdirSync(outDir, { recursive: true });

function startServer() {
  const child = spawn('pnpm', ['--filter', '@form/web', 'preview', '--port', String(port)], { cwd: root, stdio: 'ignore' });
  return child;
}
async function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const res = await fetch(base); if (res.ok) return; } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('preview server did not start');
}
async function seed(page) {
  await page.goto(`${base}/onboarding`);
  await page.getByRole('button', { name: 'ממשיכים בהקמה' }).click();
  await page.locator('#baseline').fill('90');
  await page.locator('#target').fill('80');
  await page.getByRole('button', { name: 'המשך לתכנית' }).click();
  await page.locator('#kcal').fill('2000');
  await page.locator('#protein').fill('150');
  await page.locator('#fat').fill('65');
  await page.getByRole('button', { name: 'שמירת תכנית והתחלה' }).click();
  await page.waitForURL('**/today');
}
async function bodyIncludes(page, text) {
  return (await page.locator('body').innerText()).includes(text);
}

let server = startServer();
const report = { engine: 'Playwright WebKit/WPE on Linux (WebKit engine validation; not Safari or iOS Simulator)', base, date, checks: {}, axe: {}, screenshots: [], notes: [] };
try {
  await waitForServer();
  const browser = await webkit.launch({ headless: true });
  report.browserVersion = browser.version();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await context.newPage();
  await seed(page);

  await page.goto(`${base}/nutrition/${date}?add=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.getByRole('textbox', { name: 'חיפוש במאגר המקומי' }).fill('עוף');
  await page.locator('.result-option').first().click();
  await page.getByRole('textbox', { name: 'כמות (גרם)' }).fill('180');
  await page.getByRole('button', { name: 'הוספה ליומן' }).click();
  await page.waitForTimeout(900);
  const nutritionText = await page.locator('body').innerText();
  report.checks.golden180gChicken = { status: nutritionText.includes('297') && nutritionText.includes('55.8') ? 'PASS' : 'FAIL', kcalFound: nutritionText.includes('297'), proteinFound: nutritionText.includes('55.8') };

  await page.getByRole('button', { name: 'אישור השלמת היום' }).click();
  await page.waitForTimeout(700);
  report.checks.completionMark = { status: await bodyIncludes(page, 'יום הושלם') ? 'PASS' : 'FAIL' };
  await page.getByRole('button', { name: '+ הוספת אוכל' }).click();
  await page.getByRole('button', { name: 'ידני' }).click();
  await page.getByLabel('שם הארוחה או ההערכה').fill('WebKit invalidation');
  await page.getByRole('textbox', { name: 'קלוריות' }).fill('100');
  await page.getByRole('button', { name: 'הוספת הערכה' }).click();
  await page.waitForTimeout(900);
  const invalidated = !(await bodyIncludes(page, 'יום הושלם')) && await bodyIncludes(page, 'יום חלקי');
  report.checks.completionInvalidationOnMutation = { status: invalidated ? 'PASS' : 'FAIL' };

  await page.goto(`${base}/check-in/${date}`, { waitUntil: 'networkidle' });
  await page.locator('#weight').fill('89.4');
  await page.locator('#waist').fill('92');
  await page.locator('#steps').fill('8200');
  await page.locator('#water').fill('1750');
  await page.locator('#sleep').fill('7.25');
  await page.locator('#hunger').fill('3');
  await page.locator('#energy').fill('4');
  await page.getByRole('button', { name: 'שמירת צ׳ק-אין' }).click();
  await page.waitForTimeout(900);
  report.checks.checkInSave = { status: await bodyIncludes(page, 'הכול שמור') ? 'PASS' : 'FAIL' };

  const routes = [
    ['today', '/today'],
    ['nutrition', `/nutrition/${date}`],
    ['progress', '/progress'],
    ['check-in', `/check-in/${date}`],
    ['coach', '/coach'],
    ['settings', '/settings']
  ];
  report.checks.serviceWorkerOnline = await page.evaluate(async () => ({ api: 'serviceWorker' in navigator, controller: !!navigator.serviceWorker?.controller, caches: await caches.keys() }));

  for (const [name, route] of routes) {
    await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    report.axe[name] = { violations: result.violations.length, status: result.violations.length ? 'FAIL' : 'PASS' };
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    for (const theme of ['dark', 'light']) {
      await page.evaluate((nextTheme) => { localStorage.setItem('form.theme', nextTheme); document.documentElement.dataset.theme = nextTheme; }, theme);
      for (const [name, route] of routes) {
        await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(350);
        await page.evaluate(() => window.scrollTo(0, 0));
        const filename = `${name}-${width}-${theme}.png`;
        await page.screenshot({ path: `${outDir}/${filename}`, fullPage: false });
        report.screenshots.push(`docs/evidence/webkit-visual-matrix/${filename}`);
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/nutrition/${date}?add=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  report.checks.mobileViewport390 = await page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth, noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth, pointerCoarse: matchMedia('(pointer: coarse)').matches }));

  server.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 700));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(2200);
  report.checks.realOfflineShell = { status: await bodyIncludes(page, 'יומן התזונה') ? 'PASS' : 'FAIL', method: 'preview server terminated after service-worker cache warm-up' };
  await page.getByRole('button', { name: 'ידני' }).click();
  await page.getByLabel('שם הארוחה או ההערכה').fill('WebKit offline write');
  await page.getByRole('textbox', { name: 'קלוריות' }).fill('123');
  await page.getByRole('button', { name: 'הוספת הערכה' }).click();
  await page.waitForTimeout(900);
  const offlineWrite = await bodyIncludes(page, 'WebKit offline write');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(2200);
  const offlinePersist = await bodyIncludes(page, 'WebKit offline write');
  report.checks.realOfflineWriteAndReload = { status: offlineWrite && offlinePersist ? 'PASS' : 'FAIL', offlineWrite, offlinePersist };

  await browser.close();
} finally {
  try { server.kill('SIGTERM'); } catch { /* server already exited */ }
}
fs.writeFileSync(`${root}docs/evidence/webkit-validation-results.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.checks, null, 2));
