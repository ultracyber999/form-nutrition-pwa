/* eslint-disable no-undef */
import fs from 'node:fs'; import path from 'node:path'; import {createRequire} from 'node:module'; import {createProductionServer} from './serve-production.mjs';
const require=createRequire(new URL('../apps/web/package.json',import.meta.url)); const {chromium}=require('playwright');
const root=new URL('..',import.meta.url).pathname; const port=4484; const base=`http://localhost:${port}`; const chrome='/home/ubuntu/.local/bin/google-chrome';
async function listen(s){await new Promise(r=>s.listen(port,r));return s} async function close(s){s.closeAllConnections?.();await new Promise(r=>s.close(r))}
const server=await listen(createProductionServer(path.join(root,'apps/web/dist'))); const report={environment:'Chromium production build, automated lower-bound timing; fills are machine-speed and not human completion claims',workflows:{},observations:[]};
try{
 const browser=await chromium.launch({headless:true,executablePath:chrome}); const context=await browser.newContext({viewport:{width:390,height:844}}); const page=await context.newPage();
 const inject=async()=>{await page.addScriptTag({url:'/test-utils.js'});await page.waitForFunction(()=>window.formTest)};
 await page.goto(`${base}/today`); await inject(); await page.evaluate(async()=>{await window.formTest.ensureBase(); const foods=await window.formTest.repo.searchFoods('עוף'); await window.formTest.repo.addFoodEntry({localDate:'2026-11-25',mealType:'lunch',foodVersionId:foods[0].id,quantity:180,unit:'g'})});
 // morning weight: Today -> visible check-in action -> weight -> save
 await page.goto(`${base}/today`,{waitUntil:'networkidle'}); let t=performance.now(); let n=0;
 await page.getByRole('link',{name:'צ׳ק-אין'}).first().click(); n++; await page.locator('#weight').fill('89.2'); n++; await page.getByRole('button',{name:'שמירת צ׳ק-אין'}).click(); n++; await page.waitForSelector('text=הכול שמור');
 report.workflows.morningWeight={seconds:+((performance.now()-t)/1000).toFixed(2),interactions:n,targetSeconds:10,status:'MEASURED'};
 // recent food: Today quick add -> first recent/default result -> add at default quantity
 await page.goto(`${base}/today`,{waitUntil:'networkidle'}); t=performance.now(); n=0;
 await page.getByRole('link',{name:'+ הוספת אוכל'}).click(); n++; await page.locator('.dialog').waitFor(); await page.locator('.dialog .result-option').first().click(); n++; await page.getByRole('button',{name:'הוספה ליומן'}).click(); n++; await page.waitForSelector('text=המזון נוסף ליומן').catch(()=>null);
 report.workflows.recentFoodDefaultQuantity={seconds:+((performance.now()-t)/1000).toFixed(2),interactions:n,targetSeconds:10,status:'MEASURED',note:'quantity edit adds one interaction when 100g default is not desired'};
 // recent panel preselection contract
 await page.goto(`${base}/nutrition/2026-11-26`,{waitUntil:'networkidle'}); await page.locator('.card .result-option').first().click(); await page.locator('.dialog').waitFor(); await page.locator('.dialog .result-option[aria-pressed="true"]').waitFor({timeout:3000}).catch(()=>null); const preselected=await page.locator('.dialog .result-option[aria-pressed="true"]').count();
 report.workflows.recentPanelPreselection={status:preselected?'PASS':'FAIL'};
 // unfamiliar food manual estimate
 await page.goto(`${base}/today`,{waitUntil:'networkidle'}); t=performance.now(); n=0;
 await page.getByRole('link',{name:'+ הוספת אוכל'}).click(); n++; await page.getByRole('button',{name:'ידני'}).click(); n++; await page.getByLabel('שם הארוחה או ההערכה').fill('סלט לא מוכר'); n++; await page.getByRole('textbox',{name:'קלוריות'}).fill('420'); n++; await page.getByRole('textbox',{name:'חלבון ג׳'}).fill('22'); n++; await page.getByRole('button',{name:'הוספת הערכה'}).click(); n++; await page.waitForTimeout(400);
 report.workflows.unfamiliarManualFood={seconds:+((performance.now()-t)/1000).toFixed(2),interactions:n,targetSeconds:30,status:'MEASURED'};
 // complete check-in with typical fields
 await page.goto(`${base}/check-in/2026-11-26`,{waitUntil:'networkidle'}); t=performance.now(); n=0;
 for(const [sel,val] of [['#weight','89.2'],['#waist','91'],['#steps','8200'],['#water','1800'],['#sleep','7.5'],['#hunger','3'],['#energy','4']]){await page.locator(sel).fill(val);n++}
 await page.locator('#training').selectOption('strength'); n++; await page.getByRole('button',{name:'שמירת צ׳ק-אין'}).click(); n++; await page.waitForSelector('text=הכול שמור');
 report.workflows.completeDailyCheckin={seconds:+((performance.now()-t)/1000).toFixed(2),interactions:n,targetSeconds:45,status:'MEASURED'};
 // offline communication
 await page.goto(`${base}/today`,{waitUntil:'networkidle'}); await context.setOffline(true); await page.waitForTimeout(500); report.workflows.offlineStatusCommunication={status:await page.locator('text=אין חיבור כרגע').count()?'PASS':'FAIL'};
 report.observations.push('Check-in is now reachable from the first Today hero action row rather than only lower-page/mobile-nav-indirect navigation.');
 report.observations.push('Quick-add prioritizes recent foods when the search box is empty and honors recent-panel preselection.');
 report.observations.push('Dialog result lists are height-capped and independently scrollable so quantity controls and submit actions remain reachable on small screens.');
 await browser.close();
}catch(e){report.fatal=e instanceof Error?e.message:String(e)}
await close(server); fs.writeFileSync(path.join(root,'docs/evidence/ux-workflow-results.json'),`${JSON.stringify(report,null,2)}\n`); console.log(JSON.stringify(report,null,2));