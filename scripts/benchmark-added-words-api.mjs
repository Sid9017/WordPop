/**
 * 本地基准：测量 Supabase REST 各阶段耗时（不打印密钥）
 * 用法：node scripts/benchmark-added-words-api.mjs
 */
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const raw = readFileSync(join(__dirname, "..", ".env"), "utf8");
  const out = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const ANON = env.VITE_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !ANON) {
  console.error("缺少 .env 中的 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const baseHeaders = {
  apikey: ANON,
  Authorization: `Bearer ${ANON}`,
  Accept: "application/json",
};

const FAKE_FAMILY = "00000000-0000-0000-0000-000000000001";

async function measureGet(name, pathAndQuery) {
  const url = `${SUPABASE_URL}/rest/v1/${pathAndQuery}`;
  const times = [];
  const statuses = [];
  let lastBytes = 0;
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const res = await fetch(url, { headers: baseHeaders });
    const text = await res.text();
    const t1 = performance.now();
    times.push(t1 - t0);
    statuses.push(res.status);
    lastBytes = text.length;
  }
  times.sort((a, b) => a - b);
  return {
    name,
    p50: times[2],
    min: times[0],
    max: times[4],
    status: statuses[0],
    approxBytes: lastBytes,
  };
}

async function measureHead(name, pathAndQuery) {
  const url = `${SUPABASE_URL}/rest/v1/${pathAndQuery}`;
  const headers = { ...baseHeaders, Prefer: "count=exact" };
  const times = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const res = await fetch(url, { method: "HEAD", headers });
    await res.arrayBuffer();
    const t1 = performance.now();
    times.push(t1 - t0);
  }
  times.sort((a, b) => a - b);
  return { name, p50: times[2], min: times[0], max: times[4] };
}

console.log("Supabase 基准（本机 5 次，报告 p50 / min–max）\n");

const headWords = await measureHead(
  "HEAD words count（类似 getSelectedWordCount 自定义分支）",
  `words?select=*&family_id=eq.${FAKE_FAMILY}`
);
console.log(
  `${headWords.name}: p50=${headWords.p50.toFixed(0)}ms (${headWords.min.toFixed(0)}–${headWords.max.toFixed(0)}ms)`
);

const complexSelect = encodeURIComponent("*,meanings(*),progress(*)");
const q1 = await measureGet(
  "GET words+meanings+progress（同 getAllWords 嵌套，limit=5）",
  `words?select=${complexSelect}&family_id=eq.${FAKE_FAMILY}&order=created_at.desc&limit=5`
);
console.log(
  `${q1.name}: p50=${q1.p50.toFixed(0)}ms (${q1.min.toFixed(0)}–${q1.max.toFixed(0)}), HTTP ${q1.status}, ~${(q1.approxBytes / 1024).toFixed(2)} KB`
);

const q2 = await measureGet(
  "GET bank_words 满页 1000（同 loadBankPages 单页）",
  "bank_words?select=*&bank_id=eq.TOEFL&order=word&limit=1000"
);
console.log(
  `${q2.name}: p50=${q2.p50.toFixed(0)}ms (${q2.min.toFixed(0)}–${q2.max.toFixed(0)}), HTTP ${q2.status}, ~${(q2.approxBytes / 1024).toFixed(1)} KB`
);

const q3 = await measureGet(
  "GET progress（bank_word_id not null，limit=1000）",
  `progress?select=*&family_id=eq.${FAKE_FAMILY}&bank_word_id=not.is.null&limit=1000`
);
console.log(
  `${q3.name}: p50=${q3.p50.toFixed(0)}ms (${q3.min.toFixed(0)}–${q3.max.toFixed(0)}), HTTP ${q3.status}, ~${(q3.approxBytes / 1024).toFixed(2)} KB`
);

const baseline = headWords.p50;
const bankPage = q2.p50;
console.log(
  "\n── 粗结论 ──\n" +
    `· 单次 REST 往返基线（HEAD）约 ${baseline.toFixed(0)}ms：主要是 TLS + 网络 RTT + PostgREST，很难再压到 0。\n` +
    `· 拉满 1000 条 bank_words 约 ${bankPage.toFixed(0)}ms，比 HEAD 多 ${(bankPage - baseline).toFixed(0)}ms：` +
    ` 多出来的主要是序列化与传输体积（~${(q2.approxBytes / 1024).toFixed(0)} KB 量级）。\n` +
    "· 家长页 loadWords 在首屏后还会跑无 limit 的 getAllSelectedWords：每个选中词库要 ceil(词数/1000) 次请求并行；" +
    "自定义词 getAllWords 每 1000 条带 meanings+progress，JSON 更大。\n" +
    "· 因此「慢」通常是：多次请求 × RTT + 大 JSON，而不只是「数据库算得慢」；要区分需在 Supabase Dashboard 看 Query 耗时或开 log_min_duration_statement。"
);
