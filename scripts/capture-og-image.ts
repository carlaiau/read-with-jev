import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
// Captures the real reader at Open Graph proportions. The shot must show the shipped UI, so it
// uses whatever the server actually returns: no mocked scores and no styling applied for the image.
const base=process.env.READER_URL??'http://127.0.0.1:3000';
const output=process.env.OG_IMAGE_PATH??'app/opengraph-image.png';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 // Render at a workable height, then crop to the 1.91:1 Open Graph frame.
 const page=await browser.newPage({viewport:{width:1200,height:800},deviceScaleFactor:2});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'load'});
 await page.locator('.passage').last().waitFor();
 await page.getByRole('checkbox',{name:'Elizabeth Bennet',exact:false}).check();
 await page.locator('.rail-curve').first().waitFor();
 // JEV analyses the viewport on demand; give cached or live scores a bounded chance to land.
 const highlights=await page.locator('[data-jev-highlight]').first().waitFor({timeout:45_000}).then(()=>true,()=>false);
 await page.getByRole('checkbox',{name:'Elizabeth Bennet',exact:false}).blur();
 await page.mouse.move(1199,629);
 await page.evaluate(()=>{for(const el of document.querySelectorAll('#channels nav > div'))el.scrollTop=0;});
 // Bring a real highlighted sentence into the cropped frame rather than advertising an empty page.
 const marked=page.locator('[data-jev-highlight]').first();
 if(highlights){
  const box=await marked.boundingBox();
  if(box&&box.y+box.height>560)await page.evaluate(offset=>window.scrollBy(0,offset),Math.round(box.y+box.height-520));
 }
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForTimeout(600);
 await page.screenshot({path:output,clip:{x:0,y:0,width:1200,height:630}});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({output,viewport:'1200x800 @2x cropped to 1200x630',jevHighlights:highlights,
  note:highlights?'Captured with live or cached JEV highlights.':'No JEV highlight was ready; the shot shows the reader without them.'}));
}finally{await browser.close();}
