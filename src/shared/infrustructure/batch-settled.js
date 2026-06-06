/**
 * Like Promise.allSettled but processes items in sequential chunks of `batchSize`.
 * Prevents flooding the browser connection pool and the server when importing
 * large datasets (hundreds or thousands of rows).
 *
 * @template T
 * @template R
 * @param {T[]}                  items      - Array of input items to process.
 * @param {(item: T) => Promise<R>} fn      - Async function to call for each item.
 * @param {number}               [batchSize=20] - How many requests to run in parallel per batch.
 * @returns {Promise<PromiseSettledResult<R>[]>}  Same shape as Promise.allSettled.
 */
export async function batchSettled(items, fn, batchSize = 20) {
  const results = []
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize)
    const chunkResults = await Promise.allSettled(chunk.map(fn))
    results.push(...chunkResults)
  }
  return results
}
