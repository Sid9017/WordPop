#!/usr/bin/env node
/**
 * 验证 batch 查词用的并发池：12 个各 50ms 的任务、并发 4，
 * 顺序执行需 ~600ms，并发应约 ceil(12/4)*50 ≈ 150ms（加容差）。
 * 与 src/lib/api.js 中 fetchPool 逻辑一致，便于在无浏览器环境下自测。
 */

async function fetchPool(words, concurrency, fetcher, onEachDone) {
  const n = words.length;
  if (n === 0) return [];
  const out = new Array(n);
  let next = 0;
  let finished = 0;

  async function worker() {
    while (true) {
      const i = next;
      next += 1;
      if (i >= n) break;
      const w = words[i];
      try {
        out[i] = await fetcher(w);
      } catch {
        out[i] = null;
      }
      finished += 1;
      if (onEachDone) onEachDone(finished, w);
    }
  }

  const k = Math.min(concurrency, n);
  await Promise.all(Array.from({ length: k }, () => worker()));
  return out;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const words = Array.from({ length: 12 }, (_, i) => i);
  const workMs = 50;
  const concurrency = 4;

  const t0 = Date.now();
  const out = await fetchPool(
    words,
    concurrency,
    async (x) => {
      await delay(workMs);
      return x * 2;
    },
    () => {}
  );
  const elapsed = Date.now() - t0;

  const expectedBatches = Math.ceil(words.length / concurrency);
  const expectedApprox = expectedBatches * workMs;
  const maxAllowed = expectedApprox + 120;

  const okOrder = out.every((v, i) => v === i * 2);
  if (!okOrder) {
    console.error("顺序或结果错误", out);
    process.exit(1);
  }

  if (elapsed > maxAllowed) {
    console.error(`耗时 ${elapsed}ms 超过并发预期上限 ${maxAllowed}ms（近似串行？）`);
    process.exit(1);
  }

  if (elapsed < workMs - 10) {
    console.error(`耗时 ${elapsed}ms 过短，检查测试逻辑`);
    process.exit(1);
  }

  console.log(`fetchPool 并发测试通过: ${elapsed}ms (预期约 ${expectedApprox}–${maxAllowed}ms)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
