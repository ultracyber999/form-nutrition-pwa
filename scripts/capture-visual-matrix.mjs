/* eslint-disable no-undef */
import { chromium } from 'playwright';
import fs from 'node:fs';
const routes=[['today','/today'],['nutrition','/nutrition/2026-11-25'],['checkin','/check-in/2026-11-25'],['progress','/progress'],['coach','/coach'],['settings','/settings']];
const widths=[320,390,768,1440], themes=['dark','light'];
const browser=await chromium.launch({executablePath:'/home/ubuntu/.local/bin/google-chrome',headless:true});
const context=await browser.newContext();
const page=await context.newPage();
await page.goto('http://localhost:4173/onboarding');
await page.getByRole('button',{name:'ממשיכים בהקמה'}).click();
await page.locator('#baseline').fill('90'); await page.locator('#target').fill('80');
await page.getByRole('button',{name:'המשך לתכנית'}).click();
await page.locator('#kcal').fill('2000'); await page.locator('#protein').fill('150'); await page.locator('#fat').fill('65');
await page.getByRole('button',{name:'שמירת תכנית והתחלה'}).click(); await page.waitForURL('**/today');
await page.goto('http://localhost:4173/settings');
const importFile = process.env.FORM_IMPORT_FILE;
if (importFile) {
  await page.locator('input[type=file]').first().setInputFiles(importFile);
  await page.getByRole('button',{name:'החלפה מלאה'}).click({force:true});
  await page.waitForTimeout(1200);
}
const cdp=await context.newCDPSession(page);
for (const width of widths) for (const theme of themes) {
 await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:width<768?844:900,deviceScaleFactor:1,mobile:width<768});
 for (const [name,route] of routes) {
  await page.goto('http://localhost:4173'+route,{waitUntil:'domcontentloaded',timeout:15000}).catch(()=>{});
  await page.evaluate(t=>localStorage.setItem('form.theme',t),theme);
  await page.reload({waitUntil:'networkidle'}).catch(()=>{}); await page.waitForTimeout(250);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`/home/ubuntu/repos/form/docs/evidence/visual-matrix/${name}-${width}-${theme}.png`, Buffer.from(shot.data, 'base64'));
 }
}
console.log('captured seeded exact-width matrix');
await browser.close();
