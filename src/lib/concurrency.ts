// Preserve input order, stop scheduling after a failure, and settle in-flight work before rejecting.
export async function mapConcurrent<T, R>(items: T[], concurrency: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new Error('Concurrency must be an integer from 1 to 32');
  const output = new Array<R>(items.length); let cursor = 0, failed = false, failure: unknown;
  async function worker() { while (!failed && cursor < items.length) { const index = cursor++;
    try { output[index] = await task(items[index], index); } catch (error) { if (!failed) failure = error; failed = true; }
  } }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  if (failed) throw failure; return output;
}
