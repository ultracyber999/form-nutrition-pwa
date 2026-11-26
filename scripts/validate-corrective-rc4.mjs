/* eslint-disable no-undef */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createProductionServer } from './serve-production.mjs';

const { chromium } = createRequire(new URL('../apps/web/package.json', import.meta.url))('playwright');
const root = new URL('..', import.meta.url).pathname;
const port = 4591;
const base = `http://localhost:${port}`;
const report = { environment: 'Chromium production build, real IndexedDB, application workflows', checks: {} };
const server = createProductionServer();
await new Promise((resolve) => server.listen(port, resolve));
let browser;
try {
  fs.copyFileSync(`${root}/.tmp/browser-test-utils.js`, `${root}/apps/web/dist/test-utils.js`);
  browser = await chromium.launch({ headless: true, executablePath: '/home/ubuntu/.local/bin/google-chrome', viewport: { width: 390, height: 844 } });
  const page = await browser.newPage();
  const inject = async () => { await page.addScriptTag({ url: '/test-utils.js' }); await page.waitForFunction(() => window.formTest); };
  const nav = async (route) => { await page.goto(`${base}${route}`, { waitUntil: 'networkidle' }); await inject(); };
  await nav('/today');
  await page.evaluate(() => window.formTest.ensureBase());

  // F01 application workflow: seed adequate stable 21-day evidence, verify adjustment branch, pause goal, verify safety override.
  const seeded = await page.evaluate(async () => {
    const repo = window.formTest.repo;
    const zone = 'Asia/Jerusalem';
    const fmtDate = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    const today = fmtDate(new Date());
    const utcDay = (iso) => new Date(`${iso}T00:00:00Z`);
    const add = (iso, days) => new Date(utcDay(iso).getTime() + days * 86400000).toISOString().slice(0, 10);
    for (let offset = -21; offset <= -1; offset += 1) {
      const date = add(today, offset);
      await repo.addManualEntry({ localDate: date, mealType: 'other', label: `synthetic ${date}`, nutrients: { kcal: 2000, proteinG: 150, carbG: 200, fatG: 65, fiberG: 30 } });
      await repo.markDayComplete(date);
      await repo.saveMeasurement({ type: 'weight', value: 90, unit: 'kg', measuredAt: `${date}T06:00:00.000Z`, localDate: date, source: 'manual', externalSampleId: null });
      await repo.saveCheckin({ localDate: date, steps: 8000, waterMl: 2000, sleepMinutes: 450, trainingStatus: 'rest', hunger1to5: 2, energy1to5: 4, notes: null });
    }
    return today;
  });
  await nav('/coach');
  let body = await page.locator('body').innerText();
  report.checks.f01ActiveAdjustmentBranch = { status: body.includes('ניתן לשקול התאמה קטנה') ? 'PASS' : 'FAIL', observed: body.slice(0, 400) };
  await page.evaluate(() => window.formTest.repo.updateGoal({ status: 'paused' }));
  await nav('/settings');
  await nav('/coach');
  body = await page.locator('body').innerText();
  report.checks.f01PausedGoalSafetyOverride = { status: body.includes('נדרשת בחינה של מצבך') && !body.includes('ניתן לשקול התאמה קטנה') ? 'PASS' : 'FAIL' };
  await page.evaluate(() => window.formTest.repo.updateGoal({ status: 'active' }));

  // F05 unknown calories are shown as upper bound/partial, not exact remaining.
  const today = await page.evaluate(() => window.formTest.repo.getTimeZone());
  await page.evaluate(() => window.formTest.repo.addManualEntry({ localDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), mealType: 'other', label: 'unknown calories', nutrients: { kcal: null, proteinG: 10, carbG: null, fatG: null, fiberG: null } }));
  await nav('/today');
  body = await page.locator('body').innerText();
  const ringLabel = await page.locator('.ring-wrap').getAttribute('aria-label');
  report.checks.f05UnknownCalorieUpperBound = { status: body.includes('נותרו לכל היותר') && ringLabel?.includes('לכל היותר') ? 'PASS' : 'FAIL', ringLabel, timezoneObserved: today };

  // F06 chart has broken segments for missing calendar gaps.
  await page.evaluate(async () => {
    const repo = window.formTest.repo;
    await repo.db.measurements.clear();
    for (const [date, value] of [['2026-11-01', 91], ['2026-11-02', 90.8], ['2026-11-10', 90.1]]) {
      await repo.saveMeasurement({ type: 'weight', value, unit: 'kg', measuredAt: `${date}T06:00:00.000Z`, localDate: date, source: 'manual', externalSampleId: null });
    }
  });
  await nav('/progress');
  report.checks.f06MissingDateGapSegments = { status: await page.locator('.chart-line').count() === 1 && await page.locator('.chart-point').count() === 3 ? 'PASS' : 'FAIL', lines: await page.locator('.chart-line').count(), points: await page.locator('.chart-point').count() };


  // F02/F03 repository-level integration in the real browser IndexedDB runtime.
  const repositoryRules = await page.evaluate(async () => {
    const repo = window.formTest.repo;
    const errors = [];
    try { await repo.createPlanRevision({ effectiveFrom: '2026-11-01', kcal: 2000, proteinG: 150, fatG: 65, fiberG: 30, steps: 8000, waterMl: 2000, sleepMinutesMin: 420, sleepMinutesMax: 510, strengthSessionsPerWeek: 3, reason: 'ordinary edit', policyVersion: 'form-plan-v1' }); }
    catch (error) { errors.push(error.code); }
    try { await repo.saveCheckin({ localDate: '2026-11-26', steps: 1.5, waterMl: null, sleepMinutes: null, trainingStatus: null, hunger1to5: null, energy1to5: null, notes: null }); }
    catch (error) { errors.push(error.code); }
    return errors;
  });
  report.checks.f02BrowserHistoricalPlanGuard = { status: repositoryRules.includes('historical-plan-revision') ? 'PASS' : 'FAIL', errors: repositoryRules };
  report.checks.f03BrowserRuntimeValidation = { status: repositoryRules.includes('invalid-checkin') ? 'PASS' : 'FAIL', errors: repositoryRules };

  // F07 configured profile timezone drives the actual UI date.
  const timezoneCheck = await page.evaluate(async () => {
    await window.formTest.repo.updateProfile({ timezone: 'America/New_York' });
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const get = (type) => parts.find((part) => part.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  });
  await nav('/today');
  const displayedDate = await page.locator('input[type="date"]').first().inputValue();
  report.checks.f07ConfiguredTimezoneUiDate = { status: displayedDate === timezoneCheck ? 'PASS' : 'FAIL', expected: timezoneCheck, displayedDate };
  await page.evaluate(() => window.formTest.repo.updateProfile({ timezone: 'Asia/Jerusalem' }));

  // F08 destructive import stores a recoverable pre-import backup independent of download completion.
  const backupCheck = await page.evaluate(async () => {
    const repo = window.formTest.repo;
    const before = await repo.exportBundle();
    const replacement = { ...before, foodEntries: [], exportedAt: new Date().toISOString() };
    await repo.importBundle(JSON.stringify(replacement), 'replace-all');
    const backup = await repo.getLastPreImportBackup();
    return { backupEntries: backup?.foodEntries.length ?? -1, currentEntries: (await repo.listFoodEntries()).length };
  });
  await nav('/settings');
  body = await page.locator('body').innerText();
  report.checks.f08BrowserPreImportBackup = { status: backupCheck.backupEntries > 0 && backupCheck.currentEntries === 0 && body.includes('שחזור גיבוי זה') ? 'PASS' : 'FAIL', ...backupCheck, restoreControl: body.includes('שחזור גיבוי זה') };

  // F04 UI workflow failure injection leaves no partial check-in/measurement.
  await nav(`/check-in/${seeded}`);
  await page.evaluate(() => {
    const originalAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function(...args) {
      if (this.name === 'outbox') throw new Error('browser injected interruption');
      return originalAdd.apply(this, args);
    };
  });
  await page.locator('#weight').fill('88.8');
  await page.locator('#steps').fill('7000');
  await page.getByRole('button', { name: 'שמירת צ׳ק-אין' }).click();
  await page.waitForTimeout(800);
  const partial = await page.evaluate(async (date) => {
    const checkin = await window.formTest.repo.checkinForDate(date);
    const rows = await window.formTest.repo.listMeasurements();
    return { checkin: Boolean(checkin), measurementCount: rows.filter((row) => row.localDate === date).length };
  }, seeded);
  report.checks.f04BrowserAtomicFailure = { status: !partial.checkin && partial.measurementCount === 0 ? 'PASS' : 'FAIL', ...partial };
  await browser.close();
} finally {
  try { await browser?.close(); } catch { /* browser may already be closed */ }
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(`${root}/apps/web/dist/test-utils.js`, { force: true });
}
fs.writeFileSync(`${root}/docs/evidence/corrective-validation-results.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.checks, null, 2));
