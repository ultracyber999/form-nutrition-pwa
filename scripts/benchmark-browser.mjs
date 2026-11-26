/* eslint-disable no-undef */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createProductionServer } from './serve-production.mjs';

const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { chromium, webkit } = require('playwright');
const root = new URL('..', import.meta.url).pathname;
const port = Number(process.env.FORM_BENCH_PORT || 4482);
const base = `http://localhost:${port}`;
const chrome = process.env.CHROME_PATH || '/home/ubuntu/.local/bin/google-chrome';
const stats = (xs) => ({ samples: xs.map((x) => Math.round(x)), median: +xs.sort((a,b)=>a-b)[Math.floor((xs.length-1)/2)].toFixed(1), p95: +xs.sort((a,b)=>a-b)[Math.min(xs.length-1, Math.ceil(xs.length*.95)-1)].toFixed(1) });
async function listen(server) { await new Promise((r) => server.listen(port, r)); return server; }
async function close(server) { server.closeAllConnections?.(); await new Promise((r) => server.close(r)); }
async function inject(page) { await page.addScriptTag({ url: '/test-utils.js' }); await page.waitForFunction(() => window.formTest); }
async function nav(page, url) { const t=performance.now(); await page.goto(url,{waitUntil:'networkidle'}); await page.waitForTimeout(250); return performance.now()-t; }
async function benchEngine(name, launcher, executablePath) {
  const dir=path.join(root,'.tmp',`bench-${name}`); fs.rmSync(dir,{recursive:true,force:true});
  const context=await launcher.launchPersistentContext(dir,{headless:true,executablePath,viewport:{width:390,height:844}});
  const page=context.pages()[0]??await context.newPage();
  await page.addInitScript(() => { window.__longTasks=[]; new PerformanceObserver((list)=>{for(const e of list.getEntries())window.__longTasks.push(e.duration)}).observe({entryTypes:['longtask']}); });
  const out={}; const mark=(x)=>console.error(`[bench:${name}] ${x}`);
  await page.goto(`${base}/today`,{waitUntil:'domcontentloaded'}); await inject(page);
  mark('seed:start'); const seedT=performance.now(); out.seed=await page.evaluate(()=>window.formTest.seedScale()); out.seedMs=+(performance.now()-seedT).toFixed(1); mark(`seed:done:${out.seedMs}`);
  await context.close();
  const context2=await launcher.launchPersistentContext(dir,{headless:true,executablePath,viewport:{width:390,height:844}});
  const p=context2.pages()[0]??await context2.newPage();
  await p.addInitScript(() => { window.__longTasks=[]; new PerformanceObserver((list)=>{for(const e of list.getEntries())window.__longTasks.push(e.duration)}).observe({entryTypes:['longtask']}); });
  mark('cold:start'); out.coldLoadMs=await nav(p,`${base}/today`); mark(`cold:done:${out.coldLoadMs}`);
  await inject(p);
  const warm=[]; for(let i=0;i<3;i++) warm.push(await nav(p,`${base}/today`));
  out.warmLoadMs=stats(warm);
  for (const route of ['progress','coach','settings']) { out[`${route}Ms`]=await nav(p,`${base}/${route}`); mark(`${route}:done:${out[`${route}Ms`]}`); }
  await inject(p);
  mark('repo:start'); const repoOps=await p.evaluate(async()=>{const r=window.formTest.repo; const time=async(fn)=>{const t=performance.now(); const v=await fn(); return [performance.now()-t,v]}; const [searchMs,foods]=await time(()=>r.searchFoods('עוף')); const [createMs,entry]=await time(()=>r.addFoodEntry({localDate:'2026-11-26',mealType:'other',foodVersionId:foods[0].id,quantity:100,unit:'g'})); const [editMs]=await time(()=>r.updateFoodEntry(entry.id,{quantity:120})); const [queryMs,rows]=await time(()=>r.entriesForDate('2026-11-26')); const [exportMs,bundle]=await time(()=>r.exportBundle()); const text=JSON.stringify(bundle); const [importMs]=await time(()=>r.importBundle(text,'replace-all')); return {searchMs,createMs,editMs,queryMs,exportMs,importMs,rows:rows.length,exportBytes:text.length}});
  mark('repo:done'); out.repositoryMicrobenchmarks=Object.fromEntries(Object.entries(repoOps).map(([k,v])=>[k,typeof v==='number'?+v.toFixed(1):v]));
  mark('ui:start'); await p.goto(`${base}/nutrition/2026-11-26?add=1`,{waitUntil:'networkidle'}); await p.waitForTimeout(300);
  let t=performance.now(); await p.getByRole('textbox',{name:'חיפוש במאגר המקומי'}).fill('עוף'); await p.locator('.dialog .result-option').first().waitFor({timeout:10000}); out.uiFoodSearchMs=+(performance.now()-t).toFixed(1);
  await p.locator('.dialog .result-option').first().click(); await p.getByRole('textbox',{name:'כמות (גרם)'}).fill('100'); t=performance.now(); await p.getByRole('button',{name:'הוספה ליומן'}).click(); await p.waitForTimeout(500); out.uiCreateInteractionMs=+(performance.now()-t).toFixed(1);
  const perf=await p.evaluate(()=>({longTasks:window.__longTasks.map((x)=>Math.round(x)),longTaskCount:window.__longTasks.length,memory:performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null,resources:performance.getEntriesByType('resource').filter((x)=>x.name.includes('/assets/')).map((x)=>({name:x.name.split('/').pop(),duration:Math.round(x.duration),transferSize:x.transferSize}))}));
  out.runtime=perf;
  await context2.close(); mark('engine:done');
  return out;
}
let server=await listen(createProductionServer(path.join(root,'apps/web/dist')));
const report={environment:'production static server, real browser IndexedDB, persistent profiles, 365 days/~10k entries',base,results:{},limitations:['WebKit is Linux WebKit/WPE, not Safari, iOS Simulator, or physical iPhone.','Navigation measurements use waitUntil networkidle plus a fixed 250ms settle delay; they are workflow/render proxies, not pure browser navigation metrics.','Resource transferSize/duration can be zero when served from browser or service-worker caches and therefore are not a bundle-network benchmark.','Synthetic entries are uniform catalog entries; they validate scale behavior but not every real-world data mixture.']};
try {
  if (!process.env.BENCH_ONLY || process.env.BENCH_ONLY === 'chromium') report.results.chromium=await benchEngine('chromium',chromium,chrome);
  if (!process.env.BENCH_ONLY || process.env.BENCH_ONLY === 'webkit') report.results.webkit=await benchEngine('webkit',webkit,undefined);
} catch(e) { report.fatal=e instanceof Error?e.message:String(e); }
await close(server);
fs.writeFileSync(path.join(root,'docs/evidence/browser-performance-results.json'),`${JSON.stringify(report,null,2)}\n`);
console.log(JSON.stringify(report,null,2));
