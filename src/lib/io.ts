import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}
export async function atomicWrite(path: string, value: string) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, value);
  await rename(temp, path);
}
export const writeJson = (path: string, value: unknown) => atomicWrite(path, JSON.stringify(value, null, 2) + '\n');
