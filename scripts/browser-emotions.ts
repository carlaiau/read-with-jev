import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {readingEmotions} from '../src/lib/reading-emotions';
const base=process.env.READER_URL??'http://127.0.0.1:3101';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const calls:{layer:string;sentenceId:string}[]=[];let active=0,maxActive=0,failOnce=true;
 await page.route('**/api/emotions?*',async route=>{const r=await route.fetch();const d=await r.json();assert(r.ok(),d.error);await route.fulfill({json:{...d,jevAvailable:true}});});
 await page.route('**/api/emotions',async route=>{
  const body=route.request().postDataJSON();calls.push(body);active++;maxActive=Math.max(maxActive,active);
  await new Promise(r=>setTimeout(r,120));active--;
  if(failOnce){failOnce=false;await route.fulfill({status:502,json:{error:'Fixture: temporary model failure.'}});return;}
  await route.fulfill({json:{sentenceId:body.sentenceId,scores:Object.fromEntries(readingEmotions.map(e=>[e,e==='fear'||e==='trust'?.9:.1]))}});
 });
 await page.goto(base);await page.locator('[data-emotion-id]').last().waitFor();
 await expect(page.getByRole('button',{name:'Retry analysis'})).toBeVisible();await page.getByRole('button',{name:'Retry analysis'}).click();
 await expect(page.locator('[data-jev-highlight]').first()).toBeVisible();await expect(page.locator('.emotion-status')).toContainText('JEV analyses as you scroll.');
 assert(maxActive<=2);assert(calls.length>0&&calls.length<25,'Only nearby sentences should be requested');
 await page.getByRole('button',{name:'Fear',exact:true}).scrollIntoViewIfNeeded();await page.waitForTimeout(1200);
 const firstCalls=calls.length;
 await expect(page.getByRole('group',{name:'Visible emotions'}).getByRole('button',{pressed:true})).toHaveCount(8);await expect(page.locator('[data-jev-highlight]').first()).toHaveAttribute('data-jev-highlight','fear trust');await page.getByRole('button',{name:'Fear',exact:true}).click();await expect(page.locator('[data-jev-highlight]').first()).toHaveAttribute('data-jev-highlight','trust');await expect(page.locator('[data-nrc-emotions~=fear]')).toHaveCount(0);await page.waitForTimeout(350);assert.equal(calls.length,firstCalls,'Changing emotion must reuse scores');
 await page.locator('[data-jev-highlight]').first().click();await expect(page.getByLabel('Emotion inspection',{exact:true})).toBeVisible();await expect(page.getByLabel('Emotion inspection',{exact:true})).toBeFocused();await page.getByRole('button',{name:'Supported: Trust',exact:true}).click();await expect(page.getByText('Supported · saved on this device')).toBeVisible();
 assert(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('emotion-review:'))));
 await page.getByLabel('Emotion inspection',{exact:true}).press('Escape');await expect(page.getByLabel('Emotion inspection',{exact:true})).toHaveCount(0);assert(await page.evaluate(()=>!!(document.activeElement as HTMLElement)?.dataset.emotionId));
 await page.getByRole('button',{name:'Fear',exact:true}).focus();await expect(page.getByRole('button',{name:'Fear',exact:true}).locator('.emotion-tooltip')).toHaveCSS('opacity','1');
 await page.getByRole('button',{name:'Fear',exact:true}).click();
 await expect(page.locator('[data-jev-highlight]').first()).toHaveAttribute('data-jev-highlight','fear trust');
 for(const emotion of readingEmotions)await page.getByRole('button',{name:emotion[0].toUpperCase()+emotion.slice(1),exact:true}).click();
 await expect(page.locator('[data-jev-highlight]')).toHaveCount(0);await expect(page.locator('.emotion-underline')).toHaveCount(0);await expect(page.getByText('All emotions hidden. Enable a circle to show its highlights.')).toBeVisible();
 for(const emotion of readingEmotions)await page.getByRole('button',{name:emotion[0].toUpperCase()+emotion.slice(1),exact:true}).click();
 await page.getByRole('button',{name:'Trust',exact:true}).blur();
 await page.screenshot({path:'/tmp/affect-reader-desktop.png'});
 await page.getByRole('checkbox',{name:'JEV highlights',exact:true}).uncheck();const paused=calls.length;await page.locator('#passage-15').scrollIntoViewIfNeeded();await page.waitForTimeout(450);assert.equal(calls.length,paused);assert.equal(await page.locator('[data-jev-highlight]').count(),0);
 await page.getByRole('checkbox',{name:'JEV highlights',exact:true}).check();await expect.poll(()=>calls.length).toBeGreaterThan(paused);await expect(page.locator('.emotion-status')).toContainText('JEV analyses as you scroll.');
 await page.getByRole('checkbox',{name:'NRC underlines',exact:true}).uncheck();assert.equal(await page.locator('.emotion-underline').count(),0);await page.getByRole('checkbox',{name:'NRC underlines',exact:true}).check();assert(await page.locator('.emotion-underline').count()>0);
 await page.getByLabel('Explore by').selectOption('speaking');await expect(page.locator('.passage')).toHaveCount(319);await expect.poll(()=>calls.some(c=>c.layer==='speaking')).toBe(true);
 await page.setViewportSize({width:390,height:844});await page.goto(base);await page.locator('[data-emotion-id]').last().waitFor();await expect(page.locator('[data-jev-highlight]').first()).toBeVisible();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/affect-reader-mobile.png'});
 await page.setViewportSize({width:320,height:740});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.equal((await page.request.get(`${base}/api/emotions?layer=../../.env`)).status(),400);
 assert.equal((await page.request.post(`${base}/api/emotions`,{data:{layer:'mentions',sourceKey:'stale',sentenceId:'bad'}})).status(),409);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'passed',mockedJev:true,calls:calls.length,maxConcurrent:maxActive,checks:'viewport queue, retry, reuse, pause, NRC toggle, feedback, editions, desktop/mobile, API validation'}));
}finally{await browser.close();}
