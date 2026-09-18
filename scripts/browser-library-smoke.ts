import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const baseURL = process.env.READER_URL ?? 'http://127.0.0.1:3000';
const browser = await chromium.launch({ channel:'chrome', headless:true });
try {
  const page = await browser.newPage({viewport:{width:1440,height:1000}}), errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(baseURL);
  const catalog = await (await page.request.get(`${baseURL}/.netlify/functions/library`)).json();
  await page.locator('.passage').last().waitFor();
  for(const doc of catalog.documents){
    await page.getByLabel('Document',{exact:true}).selectOption(doc.documentId);
    await page.waitForFunction(({title,count})=>document.querySelector('h1')?.textContent===title && document.querySelectorAll('.passage').length===count,{title:doc.title,count:doc.passages});
    assert.equal(await page.getByLabel('Explore by').inputValue(),'baseline');
    assert.equal(await page.getByRole('checkbox').count(),doc.characters);
    assert((await page.locator('.research-state').innerText()).includes('Baseline'));
    const first=page.getByRole('checkbox').first();await first.check();
    assert((await page.locator('.rail-curve').count())>0);
  }
  await page.getByLabel('Document',{exact:true}).selectOption('moby-dick');
  await page.waitForFunction(()=>document.querySelector('h1')?.textContent==='Moby-Dick' && document.querySelectorAll('.passage').length===553);
  await page.getByRole('slider',{name:'Book position'}).press('End');
  assert.equal(await page.getByRole('slider',{name:'Book position'}).inputValue(),'552');
  await page.getByRole('slider',{name:'Book position'}).press('Home');
  await page.screenshot({path:'/tmp/jev-library-desktop.png'});
  // Abort an in-flight document switch and verify the final selection wins.
  await page.getByLabel('Document',{exact:true}).selectOption('crime-and-punishment');
  await page.getByLabel('Document',{exact:true}).selectOption('alice-in-wonderland');
  await page.waitForFunction(()=>document.querySelector('h1')?.textContent==='Alice’s Adventures in Wonderland' && document.querySelectorAll('.passage').length===75);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Channels',exact:true}).click();
  await page.getByLabel('Document',{exact:true}).selectOption('romeo-and-juliet');
  await page.waitForFunction(()=>document.querySelectorAll('.passage').length===85);
  await page.screenshot({path:'/tmp/jev-library-mobile-channels.png'});
  await page.getByRole('button',{name:'Close channels'}).click();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'/tmp/jev-library-mobile.png'});
  assert.deepEqual(errors,[]);
  console.log('All nine documents, baseline labels, cast switching, navigation, rapid switching, and mobile width passed.');
} finally {await browser.close();}
