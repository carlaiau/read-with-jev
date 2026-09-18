import { execFileSync } from 'node:child_process';
import { atomicWrite, digest, writeJson } from '../src/lib/io';

const pdnc = '6fda0a78bda5e9da0854f7befb5dab268abefb7e';
const bookcoref = '9283951b92978f97ae6cd60eeefe79bd3a7cb34c';
const gold = '2c2587aca956a4225712abdcf1af72b93f18a28f';
const sources: { path: string; url: string; sha256: string }[] = [];
async function github(repo: string, ref: string, file: string, path: string) {
  const bytes = execFileSync('gh', ['api', `repos/${repo}/contents/${file}?ref=${ref}`, '-H', 'Accept: application/vnd.github.raw+json'], { maxBuffer: 20_000_000 });
  await atomicWrite(path, bytes.toString('utf8'));
  sources.push({ path, url: `https://github.com/${repo}/blob/${ref}/${file}`, sha256: digest(bytes) });
}
for (const file of ['character_info.csv', 'quotation_info.csv', 'novel_text.txt']) {
  await github('Priya22/project-dialogism-novel-corpus', pdnc, `data/PrideAndPrejudice/${file}`, `data/raw/pdnc/${file}`);
}
// Use ONLY sentences from these evaluation artifacts. Their predictions are never gold.
for (const file of ['maverick_xl.jsonl', 'booknlp.jsonl']) {
  await github('sapienzanlp/bookcoref', bookcoref, `predictions/off_the_shelf/${file}`, `data/raw/bookcoref/${file}`);
}
const url = `https://huggingface.co/datasets/sapienzanlp/bookcoref/resolve/${gold}/bookcoref_annotations/full/test.jsonl`;
const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
if (!response.ok) throw new Error(`Gold download failed: HTTP ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
const path = 'data/raw/bookcoref/test.jsonl';
await atomicWrite(path, bytes.toString('utf8'));
sources.push({ path, url, sha256: digest(bytes) });
await writeJson('data/raw/manifest.json', { fetchedAt: new Date().toISOString(), sources });
console.log('Downloaded pinned PDNC and BookCoref artifacts; checksums in data/raw/manifest.json.');
