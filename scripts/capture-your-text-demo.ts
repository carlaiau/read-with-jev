// Capture a reproducible paste-in demo using the running app and live JEV responses.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir,rm,stat,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium,type Page} from '@playwright/test';

const base=process.env.READER_URL??'http://127.0.0.1:3101';
const output=resolve(process.env.DEMO_OUTPUT_DIR??'data/runs');
const framesDir=resolve(output,'your-text-demo-frames');
const screenshotPath=resolve(output,'your-text-demo.png');
const videoPath=resolve(output,'your-text-demo.mp4');
const article=`In the weeks leading up to President Trump welcoming President Xi Jinping of China to Washington on Wednesday evening, Beijing has been accused of undermining America’s national interests on a number of fronts.

Mr. Trump accused the country this summer of “sinister election meddling” in the 2020 election, a breach he considered so historic he presented the claims in a prime-time address. Since the start of the war with Iran, Chinese companies have provided Tehran with satellite imagery, and access to a spy satellite, that Iran’s military forces have used to mount attacks in the region, according to multiple U.S. officials. And Beijing has shown no signs of retreating from its business dealings with Iran, in defiance of U.S. efforts to cut off economic lifelines to Tehran.

But as his meeting with Mr. Xi approached, Mr. Trump has repeatedly found ways to give him a pass — portraying him more as a personal friend than as a geopolitical competitor despite significant rivalries on matters of global power, trade, artificial intelligence and more.

Mr. Trump has spent weeks boosting the visit as a major event for the United States, sprucing up the White House beforehand, and planning for a state visit that will start with a rare greeting at Joint Base Andrews.`;

await mkdir(output,{recursive:true});
await rm(framesDir,{recursive:true,force:true});
await mkdir(framesDir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const durations:number[]=[];
let pointer:[number,number]=[800,150];
async function frame(duration=85,count=1){
 for(let index=0;index<count;index++){
  await page.screenshot({path:resolve(framesDir,`${String(durations.length).padStart(4,'0')}.png`)});
  durations.push(duration);
 }
}
async function move(to:[number,number],steps=12){
 const from=pointer;
 for(let index=1;index<=steps;index++){
  const t=index/steps,eased=t<.5?2*t*t:1-(2-2*t)**2/2;
  const x=from[0]+(to[0]-from[0])*eased,y=from[1]+(to[1]-from[1])*eased;
  await page.mouse.move(x,y);await frame(45);pointer=[x,y];
 }
}
async function analysed(){const text=await page.locator('.custom-overview-count').textContent();return Number(text?.match(/^\d+/)?.[0]??0);}
async function waitForAnalysis(target:number,timeoutMs=120_000){
 const until=Date.now()+timeoutMs;
 let seen=await analysed();
 while(Date.now()<until&&seen<target){
  await page.waitForTimeout(600);
  const current=await analysed();
  if(current>seen){await frame(120,Math.min(4,current-seen+1));seen=current;}
 }
 return seen;
}
async function visibleMarks(){
 return page.locator('[data-jev-highlight]').evaluateAll(elements=>{
  const scroller=document.querySelector('.cm-scroller')?.getBoundingClientRect();
  if(!scroller)return [];
  return elements.flatMap((element,index)=>Array.from(element.getClientRects()).filter(rect=>rect.width>28&&rect.y>scroller.top+45&&rect.bottom<scroller.bottom-30).slice(0,1).map(rect=>({index,x:rect.x+Math.min(100,rect.width/2),y:rect.y+rect.height/2,emotions:element.getAttribute('data-jev-highlight')??''})));
 });
}
async function hoverMark(skip=new Set<number>()){
 const candidates=(await visibleMarks()).filter(mark=>!skip.has(mark.index));
 for(const candidate of candidates){
  await move([candidate.x,candidate.y],10);
  try{
   await page.locator('.custom-emotion-tooltip').waitFor({state:'visible',timeout:2200});
   await frame(110,10);
   return candidate;
  }catch{}
 }
 return null;
}

try{
 await page.goto(`${base}/your-text?new=1`,{waitUntil:'load'});
 await page.locator('.cm-content').waitFor();
 await page.getByText('Guest draft · this tab').waitFor();
 const availability=await page.request.get(`${base}/api/custom-emotions`);
 assert.equal((await availability.json()).jevAvailable,true,'JEV must be available for this live demo');
 await page.evaluate(()=>{
  const pointer=document.createElement('div');pointer.className='demo-pointer';pointer.setAttribute('aria-hidden','true');
  pointer.style.cssText='position:fixed;left:0;top:0;z-index:9999;pointer-events:none;transform:translate(795px,145px)';
  pointer.innerHTML='<svg viewBox="0 0 24 24" width="25" height="25" style="filter:drop-shadow(0 1px 2px #18242d77)"><path d="M5 2.2 19 11.4l-6.2.9 3.4 6.9-2.6 1.3-3.4-7L5 17.4z" fill="#21313e" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  document.body.append(pointer);
  document.addEventListener('mousemove',event=>{pointer.style.transform=`translate(${event.clientX-3}px,${event.clientY-2}px)`;});
 });
 await frame(100,10);
 const title=page.getByRole('textbox',{name:'Text title'});
 const titleBox=await title.boundingBox();assert(titleBox);
 await move([titleBox.x+75,titleBox.y+titleBox.height/2]);await page.mouse.click(titleBox.x+75,titleBox.y+titleBox.height/2);
 await title.fill('');
 for(const character of 'Xi Visits Washington'){await page.keyboard.insertText(character);await frame(75);}
 await frame(125,5);
 const editor=page.locator('.cm-content');const editorBox=await editor.boundingBox();assert(editorBox);
 await move([editorBox.x+110,editorBox.y+45]);await page.mouse.click(editorBox.x+110,editorBox.y+45);
 await frame(100,5);
 await page.keyboard.insertText(article);
 await frame(125,8);
 assert.equal(await editor.evaluate(element=>(element as HTMLElement).closest('.cm-editor')?.querySelector('.cm-content')?.textContent?.replace(/\n/g,'\n').includes('Joint Base Andrews.')),true,'Pasted article must include the final sentence');
 const firstCount=await waitForAnalysis(3);
 assert(firstCount>=3,'At least three live JEV classifications must complete');
 if(await page.locator('[data-jev-highlight]').count()===0){await page.getByLabel('How emotional is JEV',{exact:true}).fill('75');await frame(110,7);}
 assert(await page.locator('[data-jev-highlight]').count()>0,'Live JEV responses must produce highlights');
 const first=await hoverMark();assert(first,'A visible highlight must expose its emotion tooltip');
 await page.screenshot({path:screenshotPath});
 await move([1000,180],11);await frame(80,5);
 const second=await hoverMark(new Set([first.index]));
 if(second)await move([1000,180],10);
 const scroller=page.locator('.cm-scroller');
 for(let step=0;step<12;step++){await scroller.evaluate(element=>{element.scrollTop+=45;});await frame(65);}
 const laterCount=await waitForAnalysis(firstCount+2,90_000);
 const third=await hoverMark();
 if(third)await frame(125,7);
 await writeFile(resolve(framesDir,'frames.json'),JSON.stringify(durations));
 const lines=durations.flatMap((duration,index)=>[`file '${String(index).padStart(4,'0')}.png'`,`duration ${(duration/1000).toFixed(3)}`]);
 await writeFile(resolve(framesDir,'concat.txt'),[...lines,`file '${String(durations.length-1).padStart(4,'0')}.png'`].join('\n')+'\n');
 const encoding=spawnSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i','concat.txt','-vf','format=yuv420p','-r','30','-c:v','libx264','-preset','medium','-crf','19','-movflags','+faststart',videoPath],{cwd:framesDir,encoding:'utf8'});
 assert.equal(encoding.status,0,encoding.stderr||encoding.error?.message||'ffmpeg failed');
 console.log(JSON.stringify({screenshot:screenshotPath,video:videoPath,frames:durations.length,seconds:durations.reduce((sum,value)=>sum+value,0)/1000,analysed:laterCount,hovered:[first.emotions,second?.emotions,third?.emotions].filter(Boolean),videoBytes:(await stat(videoPath)).size}));
}finally{await browser.close();}
