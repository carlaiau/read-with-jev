// Drives the reader through a short scripted demo and writes numbered PNG frames plus their
// durations. Frames are the source for a GIF or an MP4; nothing here encodes video.
import {chromium, type Page} from '@playwright/test';
import {mkdir, rm, writeFile} from 'node:fs/promises';
const base=process.env.READER_URL??'http://127.0.0.1:3000';
const dir=process.env.FRAME_DIR??'data/runs/demo-frames';
const W=1280,H=800,CAST=['Elizabeth Bennet','Jane Bennet']  // adjacent in the list, so both stay visible on screen;
await rm(dir,{recursive:true,force:true});await mkdir(dir,{recursive:true});

const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:2});
let inFlight=0,settledAt=Date.now();
page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/api/emotions'))inFlight++;});
const done=(r:{method():string;url():string})=>{if(r.method()==='POST'&&r.url().includes('/api/emotions')){inFlight--;settledAt=Date.now();}};
page.on('requestfinished',done);page.on('requestfailed',done);
const settle=async(page:Page,quietMs=4000,capMs=180_000)=>{
 const deadline=Date.now()+capMs;
 while(Date.now()<deadline&&(inFlight>0||Date.now()-settledAt<quietMs))await page.waitForTimeout(400);
};

const frames:{duration:number}[]=[];
async function shoot(duration=60,count=1){
 for(let i=0;i<count;i++){
  await page.screenshot({path:`${dir}/${String(frames.length).padStart(4,'0')}.png`});
  frames.push({duration});
 }
}
const cursor=(x:number,y:number)=>page.evaluate(([x,y])=>(window as never as {__cursor:(x:number,y:number)=>void}).__cursor(x,y),[x,y]);
async function glide(from:[number,number],to:[number,number],steps:number){
 for(let i=1;i<=steps;i++){
  const t=i/steps,ease=t<.5?2*t*t:1-(-2*t+2)**2/2;
  const x=from[0]+(to[0]-from[0])*ease,y=from[1]+(to[1]-from[1])*ease;
  await page.mouse.move(x,y);await cursor(x,y);await shoot();
 }
}
async function scroll(distance:number,steps:number){
 for(let i=0;i<steps;i++){
  await page.evaluate(d=>window.scrollBy({top:d,behavior:'instant'}),distance/steps);
  await shoot(55);
 }
}

await page.goto(base,{waitUntil:'load'});
await page.locator('.passage').last().waitFor();
for(const name of CAST)await page.getByRole('checkbox',{name,exact:false}).check();
await page.locator('.rail-curve').nth(1).waitFor();
// Show the selected cast rather than the "all passages" card at the top of the list.
await page.evaluate(()=>{const body=document.querySelectorAll('#channels nav > div')[1];if(body)body.scrollTop=74;});

// Pre-roll: walk the stretch the demo will scroll through so JEV has already scored it, then
// return to the top. Without this the recording would show empty text waiting on the model.
const RUN=2100;
for(let y=0;y<=RUN;y+=H-160){await page.evaluate(t=>window.scrollTo({top:t,behavior:'instant'}),y);await settle(page,2500);}
await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
await settle(page,3000);

// A drawn pointer stands in for the real cursor, which screenshots never capture.
await page.evaluate(()=>{
 const el=document.createElement('div');
 el.style.cssText='position:fixed;left:0;top:0;z-index:9999;pointer-events:none;will-change:transform';
 el.innerHTML='<svg viewBox="0 0 24 24" width="25" height="25" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))"><path d="M5 2.2 19 11.4l-6.2.9 3.4 6.9-2.6 1.3-3.4-7L5 17.4z" fill="#12202c" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
 document.body.append(el);
 (window as never as {__cursor:(x:number,y:number)=>void}).__cursor=(x,y)=>{el.style.transform=`translate(${x-3}px,${y-2}px)`;};
});

const dial=(await page.locator('#emotion-dial').boundingBox())!;
const trackY=dial.y+dial.height/2,left=dial.x+8,right=dial.x+dial.width-8,mid=left+(right-left)*.5;
// The tooltip sits above the sentence, so only the top of a wrapped highlight has to be clear.
const onScreen=async()=>{
 for(const handle of await page.locator('[data-jev-highlight]').all()){
  const box=await handle.boundingBox();
  if(box&&box.y>170&&box.y<H-70)return box;
 }
 return undefined;
};

await cursor(860,470);
await shoot(90,10);                    // open on two characters tracked through the book
await scroll(1150,46);                 // read down; highlights and the map marker keep pace
await shoot(90,8);
const target=await onScreen();
let from:[number,number]=[860,470];
if(target){                            // hover one highlight for the emotions behind it
 const hover:[number,number]=[target.x+target.width*.35,target.y+16];
 await glide(from,hover,16);await page.waitForTimeout(220);await shoot(110,14);from=hover;
}
await glide(from,[mid,trackY],16);     // then the dial: loosen it and highlights bloom
await page.mouse.down();
await glide([mid,trackY],[right,trackY],26);
await page.mouse.up();
await shoot(100,12);
await page.mouse.down();
await glide([right,trackY],[mid,trackY],18);
await page.mouse.up();
await shoot(90,8);
await scroll(700,28);                  // keep reading
await shoot(110,10);

await writeFile(`${dir}/frames.json`,JSON.stringify(frames));
console.log(JSON.stringify({frames:frames.length,size:`${W}x${H}@2x`,cast:CAST,
 seconds:+(frames.reduce((n,f)=>n+f.duration,0)/1000).toFixed(1),hoveredHighlight:!!target}));
await browser.close();
