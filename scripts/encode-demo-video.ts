// Encodes frames from `npm run demo:frames` into an H.264 MP4 suitable for social posts.
// Requires ffmpeg on PATH (`brew install ffmpeg`); nothing else in the project depends on it.
import {spawnSync} from 'node:child_process';
import {readFile, writeFile, readdir, stat} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir=process.env.FRAME_DIR??'data/runs/demo-frames';
const output=process.env.DEMO_VIDEO_PATH??'data/runs/read-with-jev-demo.mp4';
const durations=JSON.parse(await readFile(`${dir}/frames.json`,'utf8')) as {duration:number}[];
const names=(await readdir(dir)).filter(name=>name.endsWith('.png')).sort();
assert.equal(names.length,durations.length,'Frame count does not match the recorded durations');
// The concat demuxer honours per-frame holds; it needs the final frame repeated to time the last one.
const lines=names.flatMap((name,i)=>[`file '${name}'`,`duration ${(durations[i].duration/1000).toFixed(3)}`]);
await writeFile(`${dir}/concat.txt`,[...lines,`file '${names.at(-1)}'`].join('\n')+'\n');
const result=spawnSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i','concat.txt',
 // Frames are captured at 2x; cap the long edge at 1280 so the file stays inside social limits.
 '-vf',"scale='min(1280,iw)':-2:flags=lanczos,format=yuv420p",'-r','30','-c:v','libx264','-preset','veryslow','-crf','20',
 '-movflags','+faststart','-pix_fmt','yuv420p',output.startsWith('/')?output:`${process.cwd()}/${output}`],
 {cwd:dir,encoding:'utf8'});
assert(result.status===0,`ffmpeg failed: ${result.stderr||result.error?.message||'is ffmpeg installed?'}`);
const {size}=await stat(output);
console.log(JSON.stringify({output,frames:names.length,
 seconds:+(durations.reduce((n,f)=>n+f.duration,0)/1000).toFixed(1),megabytes:+(size/1e6).toFixed(2)}));
