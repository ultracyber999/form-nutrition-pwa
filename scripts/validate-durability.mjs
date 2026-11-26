/* eslint-disable no-undef */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createProductionServer } from './serve-production.mjs';

const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { chromium } = require('playwright');
const root = new URL('..', import.meta.url).pathname;
const tmp = path.join(root, '.tmp/durability');
const port = Number(process.env.FORM_DURABILITY_PORT || 4481);
const base = `http://localhost:${port}`;
const chrome = process.env.CHROME_PATH || '/home/ubuntu/.local/bin/google-chrome';
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });
const cp = (from, to) => fs.cpSync(from, to, { recursive: true });
const dist = path.join(root, 'apps/web/dist');
const v1 = path.join(tmp, 'dist-v1');
const v2 = path.join(tmp, 'dist-v2');
const broken = path.join(tmp, 'dist-broken');
cp(dist, v1); cp(dist, v2); cp(dist, broken);
for (const dir of [v1, v2, broken]) fs.copyFileSync(path.join(root, '.tmp/browser-test-utils.js'), path.join(dir, 'test-utils.js'));
const sw2 = path.join(v2, 'sw.js');
fs.writeFileSync(sw2, fs.readFileSync(sw2, 'utf8').replace(/form-shell-build-[a-f0-9]{12}/g, 'form-shell-build-upgradev2'));
fs.writeFileSync(path.join(v2, 'index.html'), fs.readFileSync(path.join(v2, 'index.html'), 'utf8').replace('</body>', '<!-- deployment-v2 --></body>'));
fs.writeFileSync(path.join(broken, 'sw.js'), 'throw new Error("simulated failed service-worker installation");\n');

async function listen(server) { await new Promise((resolve) => server.listen(port, resolve)); return server; }
async function close(server) { if (server) { server.closeAllConnections?.(); await new Promise((resolve) => server.close(resolve)); } }
async function start(dir) { return listen(createProductionServer(dir)); }
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
async function inject(page) {
  await page.addScriptTag({ url: '/test-utils.js' });
  await page.waitForFunction(() => window.formTest);
}
async function snapshot(page) { return page.evaluate(() => window.formTest.logicalSnapshot()); }
async function swState(page) { return page.evaluate(async () => ({ controller: !!navigator.serviceWorker?.controller, caches: await caches.keys(), version: (await indexedDB.databases()).find((db) => db.name === 'form-local')?.version ?? null })); }

const report = { environment: 'Chromium persistent profile, real IndexedDB, production static server', base, checks: {}, limitations: [] };
let server = await start(v1);
let browser;
try {
  browser = await chromium.launchPersistentContext(path.join(tmp, 'profile'), { headless: true, executablePath: chrome, viewport: { width: 390, height: 844 } });
  const page = browser.pages()[0] ?? await browser.newPage();
  await page.goto(`${base}/today`, { waitUntil: 'networkidle' });
  await inject(page);
  await page.evaluate(async () => {
    await window.formTest.ensureBase();
    const foods = await window.formTest.repo.searchFoods('עוף');
    await window.formTest.repo.addFoodEntry({ localDate: '2026-11-26', mealType: 'lunch', foodVersionId: foods[0].id, quantity: 180, unit: 'g' });
  });
  await page.goto(`${base}/today`, { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  await inject(page);
  const initialSw = await swState(page);
  const before = await snapshot(page);
  report.checks.installAndOnlinePersistence = { status: initialSw.controller && before.counts.foodEntries === 1 ? 'PASS' : 'FAIL', initialSw };

  await close(server); server = null;
  const offlineResponse = await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
  const offlineStatus = offlineResponse?.status() ?? null;
  const offlineRendered = await page.waitForFunction(() => document.body.innerText.includes('תמונת המצב'), null, { timeout: 8000 }).then(() => true).catch(() => false);
  const offlineBodyStart = await page.evaluate(() => document.body.innerText.slice(0, 160)).catch((error) => `unreadable: ${error.message}`);
  await inject(page);
  await page.evaluate(() => window.formTest.repo.addManualEntry({ localDate: '2026-11-26', mealType: 'other', label: 'offline durability write', nutrients: { kcal: 50, proteinG: 1, carbG: 2, fatG: 1, fiberG: 0 } }));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(900);
  await inject(page);
  const afterOffline = await snapshot(page);
  report.checks.offlineCrudAndPersistence = { status: offlineRendered && afterOffline.counts.foodEntries === 2 ? 'PASS' : 'FAIL', offlineRendered, offlineStatus, offlineBodyStart, entries: afterOffline.counts.foodEntries };

  server = await start(v1);
  await page.goto(`${base}/today`, { waitUntil: 'networkidle' });
  await inject(page);
  const exportedV1 = await page.evaluate(() => window.formTest.repo.exportBundle());
  const page2 = await browser.newPage();
  await page2.goto(`${base}/progress`, { waitUntil: 'networkidle' });
  await inject(page2);
  await close(server); server = await start(v2);
  await page.bringToFront();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.formTest).catch(() => null);
  await page.waitForFunction(async () => (await caches.keys()).length === 1 && (await caches.keys())[0] === 'form-shell-build-upgradev2', null, { timeout: 8000 }).catch(() => null);
  await inject(page);
  const upgradedSw = await swState(page);
  const afterUpgrade = await snapshot(page);
  const htmlHasV2 = await page.evaluate(() => document.documentElement.innerHTML.includes('deployment-v2'));
  const secondTabSnapshot = await snapshot(page2);
  report.checks.upgradeActivationCacheTransition = { status: upgradedSw.controller && upgradedSw.caches.includes('form-shell-build-upgradev2') && !upgradedSw.caches.some((key) => initialSw.caches.includes(key) && key !== 'form-shell-build-upgradev2') && eq(afterOffline, afterUpgrade) ? 'PASS' : 'FAIL', beforeCaches: initialSw.caches, afterCaches: upgradedSw.caches, logicalEquivalent: eq(afterOffline, afterUpgrade) };
  report.checks.staleCachedShellDoesNotOverrideUpdate = { status: htmlHasV2 ? 'PASS' : 'FAIL' };
  report.checks.concurrentTabDataAccess = { status: eq(afterUpgrade, secondTabSnapshot) ? 'PASS' : 'FAIL' };

  const exportedV2 = await page.evaluate(() => window.formTest.repo.exportBundle());
  await page.evaluate((text) => window.formTest.repo.importBundle(text, 'replace-all'), JSON.stringify(exportedV2));
  const afterRestore = await snapshot(page);
  report.checks.backupRestoreAfterUpgrade = { status: eq(afterUpgrade, afterRestore) && exportedV1.foodEntries.length === exportedV2.foodEntries.length ? 'PASS' : 'FAIL', entries: exportedV2.foodEntries.length };

  await browser.close();
  browser = await chromium.launchPersistentContext(path.join(tmp, 'profile'), { headless: true, executablePath: chrome, viewport: { width: 390, height: 844 } });
  const restarted = browser.pages()[0] ?? await browser.newPage();
  await restarted.goto(`${base}/today`, { waitUntil: 'networkidle' });
  await inject(restarted);
  const afterRestart = await snapshot(restarted);
  report.checks.interruptedBrowserRestartPersistence = { status: eq(afterUpgrade, afterRestart) ? 'PASS' : 'FAIL' };

  await close(server); server = await start(broken);
  const cachesBeforeBroken = await swState(restarted);
  await restarted.reload({ waitUntil: 'networkidle' }).catch(() => null);
  await restarted.waitForTimeout(1800);
  await inject(restarted);
  const brokenState = await swState(restarted);
  const afterBroken = await snapshot(restarted);
  report.checks.failedUpdateInstallationRecovery = { status: eq(afterUpgrade, afterBroken) && JSON.stringify(brokenState.caches) === JSON.stringify(cachesBeforeBroken.caches) ? 'PASS' : 'FAIL', caches: brokenState.caches };

  await close(server); server = await start(v1);
  await restarted.reload({ waitUntil: 'networkidle' });
  await restarted.waitForTimeout(1200);
  await inject(restarted);
  const afterRollback = await snapshot(restarted);
  report.checks.applicationRollbackSchemaCompatibility = { status: eq(afterUpgrade, afterRollback) ? 'PASS' : 'FAIL', databaseVersion: (await swState(restarted)).version };
  report.checks.databaseSchemaMigrations = { status: 'NOT APPLICABLE', reason: 'production schema is still version 1; upgrade/rollback preserve version 1. Legacy import migration and failed-import rollback are covered by repository tests.' };
  report.checks.storageQuotaFailures = { status: 'BLOCKED', reason: 'no deterministic browser-supported quota-failure emulation is available in this environment; recovery copy is documented rather than claimed tested' };
} catch (error) {
  report.fatal = error instanceof Error ? error.message : String(error);
} finally {
  if (browser) await browser.close().catch(() => null);
  await close(server);
}
fs.mkdirSync(path.join(root, 'docs/evidence'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/evidence/durability-validation-results.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.checks, null, 2));
