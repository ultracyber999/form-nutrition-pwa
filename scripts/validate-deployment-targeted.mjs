/* eslint-disable no-undef */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createProductionServer } from './serve-production.mjs';

const { chromium } = createRequire(new URL('../apps/web/package.json', import.meta.url))('playwright');
const root = new URL('..', import.meta.url).pathname;
const port = 4592;
const base = `http://localhost:${port}`;
const report = { environment: 'Chromium production build, real IndexedDB, targeted final-review workflows', checks: {} };
const server = createProductionServer();
await new Promise((resolve) => server.listen(port, resolve));
let browser;
try {
  fs.copyFileSync(`${root}/.tmp/browser-test-utils.js`, `${root}/apps/web/dist/test-utils.js`);
  browser = await chromium.launch({ headless: true, executablePath: '/home/ubuntu/.local/bin/google-chrome' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();
  const inject = async () => { await page.addScriptTag({ url: '/test-utils.js' }); await page.waitForFunction(() => window.formTest); };
  const nav = async (route) => { await page.goto(`${base}${route}`, { waitUntil: 'networkidle' }); await inject(); };
  await nav('/today');
  await page.evaluate(() => window.formTest.ensureBase());

  const today = await page.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));

  // Final-review point 1: concerning symptoms are entered through the real check-in workflow and block coaching reductions.
  await nav(`/check-in/${today}`);
  await page.locator('#concerning-symptoms').check();
  await page.getByRole('button', { name: 'שמירת צ׳ק-אין' }).click();
  await page.waitForTimeout(700);
  const symptomSaved = await page.evaluate(async (date) => (await window.formTest.repo.checkinForDate(date))?.concerningSymptoms === true, today);
  await nav('/coach');
  let body = await page.locator('body').innerText();
  report.checks.concerningSymptomsWorkflowSafetyOverride = {
    status: symptomSaved && body.includes('נדרשת בחינה של מצבך') && !body.includes('ניתן לשקול התאמה קטנה') ? 'PASS' : 'FAIL',
    symptomSaved,
    safetyReviewVisible: body.includes('נדרשת בחינה של מצבך')
  };

  // Final-review point 3: use the real Settings import controls, then restore the durable pre-import backup through its visible control.
  await page.evaluate(async (date) => window.formTest.repo.addManualEntry({ localDate: date, mealType: 'other', label: 'backup restoration sentinel', nutrients: { kcal: 123, proteinG: 10, carbG: 12, fatG: 4, fiberG: 2 } }), today);
  const exportState = await page.evaluate(async () => {
    const bundle = await window.formTest.repo.exportBundle();
    const replacement = { ...bundle, foodEntries: [], exportedAt: new Date().toISOString() };
    return { bundle, replacement, originalEntries: bundle.foodEntries.length };
  });
  const replacementPath = path.join(os.tmpdir(), 'form-empty-replacement.json');
  fs.writeFileSync(replacementPath, JSON.stringify(exportState.replacement));
  await nav('/settings');
  await page.locator('input[type="file"]').first().setInputFiles(replacementPath);
  await page.getByRole('button', { name: 'החלפה מלאה' }).click();
  await page.waitForTimeout(1100);
  const afterImport = await page.evaluate(async () => ({ entries: (await window.formTest.repo.listFoodEntries()).length, backupEntries: (await window.formTest.repo.getLastPreImportBackup())?.foodEntries.length ?? -1 }));
  await page.getByRole('button', { name: 'שחזור גיבוי זה' }).click();
  await page.waitForTimeout(1200);
  const afterRestore = await page.evaluate(async () => ({ entries: (await window.formTest.repo.listFoodEntries()).length, backupExists: Boolean(await window.formTest.repo.getLastPreImportBackup()) }));
  body = await page.locator('body').innerText();
  report.checks.preImportBackupRestoreEndToEnd = {
    status: afterImport.entries === 0 && afterImport.backupEntries === exportState.originalEntries && afterRestore.entries === exportState.originalEntries && body.includes('שוחזר הגיבוי') ? 'PASS' : 'FAIL',
    originalEntries: exportState.originalEntries,
    afterImport,
    afterRestore,
    restoreNotice: body.includes('שוחזר הגיבוי')
  };
  fs.rmSync(replacementPath, { force: true });
  await context.close();

  // Final-review point 2: a continuously open Today route rolls over at midnight; fastForward intentionally models laptop/application resume.
  const clockContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const clockPage = await clockContext.newPage();
  await clockPage.clock.install({ time: new Date('2026-11-25T21:59:20.000Z') });
  const clockNav = async (route) => { await clockPage.goto(`${base}${route}`, { waitUntil: 'networkidle' }); await clockPage.addScriptTag({ url: '/test-utils.js' }); await clockPage.waitForFunction(() => window.formTest); };
  await clockNav('/today');
  await clockPage.evaluate(() => window.formTest.ensureBase());
  await clockNav('/today');
  const beforeMidnight = await clockPage.locator('input[type="date"]').first().inputValue();
  await clockPage.clock.fastForward(70000);
  await clockPage.waitForTimeout(150);
  const afterMidnight = await clockPage.locator('input[type="date"]').first().inputValue();
  report.checks.continuouslyOpenMidnightRolloverResume = {
    status: beforeMidnight === '2026-11-25' && afterMidnight === '2026-11-26' ? 'PASS' : 'FAIL',
    beforeMidnight,
    afterMidnight,
    method: 'Playwright clock.fastForward, documented as laptop-close/reopen semantics; focus/visibility listeners also installed'
  };
  await clockContext.close();

  // Coach dependency regression: a continuously open Coach recomputes after midnight and revalidates safety immediately before applying.
  const coachClockContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const coachPage = await coachClockContext.newPage();
  await coachPage.clock.install({ time: new Date('2026-11-25T21:59:20.000Z') });
  const coachNav = async (route) => { await coachPage.goto(`${base}${route}`, { waitUntil: 'networkidle' }); await coachPage.addScriptTag({ url: '/test-utils.js' }); await coachPage.waitForFunction(() => window.formTest); };
  await coachNav('/today');
  await coachPage.evaluate(async () => {
    await window.formTest.ensureBase();
    const repo = window.formTest.repo;
    const zone = 'Asia/Jerusalem';
    const fmtDate = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    const today = fmtDate(new Date());
    const utcDay = (iso) => new Date(`${iso}T00:00:00Z`);
    const add = (iso, days) => new Date(utcDay(iso).getTime() + days * 86400000).toISOString().slice(0, 10);
    for (let offset = -23; offset <= -1; offset += 1) {
      const date = add(today, offset);
      await repo.addManualEntry({ localDate: date, mealType: 'other', label: `coach dependency ${date}`, nutrients: { kcal: 2000, proteinG: 150, carbG: 200, fatG: 65, fiberG: 30 } });
      await repo.markDayComplete(date);
      await repo.saveMeasurement({ type: 'weight', value: 90, unit: 'kg', measuredAt: `${date}T06:00:00.000Z`, localDate: date, source: 'manual', externalSampleId: null });
      await repo.saveCheckin({ localDate: date, steps: 8000, waterMl: 2000, sleepMinutes: 450, trainingStatus: 'rest', hunger1to5: 2, energy1to5: 4, notes: null });
    }
  });
  await coachNav('/coach');
  await coachPage.getByRole('button', { name: 'תצוגת שינוי מוצעת' }).click();
  const initialEffectiveDate = await coachPage.locator('input[type="date"]').first().inputValue();
  await coachPage.clock.fastForward(70000);
  await coachPage.waitForFunction(() => document.body.innerText.includes('2026-11-26'), null, { timeout: 5000 }).catch(() => {});
  await coachPage.waitForTimeout(200);
  const rolloverBody = await coachPage.locator('body').innerText();
  const rolloverEffectiveDate = await coachPage.locator('input[type="date"]').first().inputValue();
  report.checks.coachMidnightDateDependencies = {
    status: initialEffectiveDate === '2026-11-25' && rolloverEffectiveDate === '2026-11-26' && rolloverBody.includes('2026-11-26') ? 'PASS' : 'FAIL',
    initialEffectiveDate,
    rolloverEffectiveDate,
    asOfUpdated: rolloverBody.includes('2026-11-26')
  };
  const planCountBefore = await coachPage.evaluate(async () => (await window.formTest.repo.listPlans()).length);
  await coachPage.evaluate(() => window.formTest.repo.saveCheckin({ localDate: '2026-11-26', steps: null, waterMl: null, sleepMinutes: null, trainingStatus: null, hunger1to5: null, energy1to5: null, notes: null, concerningSymptoms: true }));
  await coachPage.getByRole('button', { name: 'אישור ויצירת גרסה חדשה' }).click();
  await coachPage.waitForTimeout(1000);
  const safetyBody = await coachPage.locator('body').innerText();
  const planCountAfter = await coachPage.evaluate(async () => (await window.formTest.repo.listPlans()).length);
  report.checks.coachSafetyRevalidationBeforeApply = {
    status: planCountAfter === planCountBefore && safetyBody.includes('ההמלצה השתנתה') ? 'PASS' : 'FAIL',
    planCountBefore,
    planCountAfter,
    staleWarningVisible: safetyBody.includes('ההמלצה השתנתה')
  };
  await coachClockContext.close();
  await browser.close();
} finally {
  try { await browser?.close(); } catch { /* browser may already be closed */ }
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(`${root}/apps/web/dist/test-utils.js`, { force: true });
}
fs.writeFileSync(`${root}/docs/evidence/deployment-targeted-validation-results.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.checks, null, 2));
