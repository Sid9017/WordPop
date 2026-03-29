#!/usr/bin/env node
/**
 * 测量生产站点「家长页」相关请求的耗时，输出 Markdown 报告。
 *
 * 用法:
 *   node scripts/benchmark-parent-page-api.mjs
 *   BASE_URL=https://wordpopp.netlify.app node scripts/benchmark-parent-page-api.mjs
 *   OUT=./reports/foo.md node scripts/benchmark-parent-page-api.mjs
 *
 * Supabase / 家庭数据：读取项目根目录 .env 中的 VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY、VITE_PIN
 *（可选覆盖：BENCHMARK_FAMILY_ID=uuid）
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const BASE_URL = (process.env.BASE_URL || "https://wordpopp.netlify.app").replace(/\/$/, "");
const OUT = process.env.OUT || join(ROOT, "reports", `parent-api-benchmark-${isoDate()}.md`);

function isoDate() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function loadDotEnv() {
  const env = {};
  try {
    const raw = readFileSync(join(ROOT, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[m[1]] = v;
    }
  } catch {
    // no .env
  }
  return env;
}

const dotenv = loadDotEnv();
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || dotenv.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY || dotenv.VITE_SUPABASE_ANON_KEY || "";
const VITE_PIN = process.env.VITE_PIN || dotenv.VITE_PIN || "";
const BENCHMARK_FAMILY_ID = process.env.BENCHMARK_FAMILY_ID || "";

const DEFAULT_UA = "WordPop-parent-benchmark/1.0 (Node; +https://github.com/)";

async function timeFetch(name, url, init = {}) {
  const t0 = performance.now();
  let status = 0;
  let ok = false;
  let bytes = 0;
  let err = "";
  try {
    const headers = { "User-Agent": DEFAULT_UA, ...init.headers };
    const res = await fetch(url, {
      ...init,
      headers,
      redirect: "follow",
    });
    status = res.status;
    ok = res.ok;
    const buf = await res.arrayBuffer();
    bytes = buf.byteLength;
  } catch (e) {
    err = e?.message || String(e);
  }
  const ms = Math.round((performance.now() - t0) * 100) / 100;
  return { name, url, method: init.method || "GET", status, ok, ms, bytes, err };
}

function youdaoDictsParam() {
  const dicts = encodeURIComponent(
    JSON.stringify({ count: 99, dicts: [["ec", "blng_sents_part"]] })
  );
  return dicts;
}

function supabaseHeaders() {
  return {
    apikey: SUPABASE_ANON,
    Authorization: `Bearer ${SUPABASE_ANON}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Accept-Profile": "public",
    "Content-Profile": "public",
  };
}

async function resolveFamilyId() {
  if (BENCHMARK_FAMILY_ID) return BENCHMARK_FAMILY_ID;
  if (!SUPABASE_URL || !SUPABASE_ANON || !VITE_PIN) return null;
  const url = `${SUPABASE_URL}/rest/v1/families?pin=eq.${encodeURIComponent(VITE_PIN)}&select=id`;
  const res = await fetch(url, { headers: supabaseHeaders() });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0]?.id || null;
}

async function supabaseTimed(name, pathAndQuery, method = "GET", extraHeaders = {}) {
  const url = `${SUPABASE_URL}${pathAndQuery}`;
  return timeFetch(name, url, { method, headers: { ...supabaseHeaders(), ...extraHeaders } });
}

async function main() {
  const rows = [];
  const notes = [];

  // --- Netlify：页面与代理 ---
  const youdaoPath = `/youdao-api/jsonapi_s?doctype=json&jsonversion=4&le=en&q=${encodeURIComponent("hello")}&dicts=${youdaoDictsParam()}`;

  rows.push(await timeFetch("文档壳 index.html（任意路由回退）", `${BASE_URL}/parent`));
  rows.push(await timeFetch("有道代理（经 Netlify）", `${BASE_URL}${youdaoPath}`));
  rows.push(await timeFetch("静态词库 JSON（示例 CET4）", `${BASE_URL}/data/word-banks/CET4.json`));

  // --- Supabase：解析家庭并模拟家长页首屏 ---
  const familyId = await resolveFamilyId();
  if (!familyId) {
    notes.push(
      "未执行 Supabase 分项测试：请在项目根 `.env` 中配置 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_PIN`，或设置环境变量 `BENCHMARK_FAMILY_ID`。"
    );
  } else {
    const fid = familyId;

    const r1 = await supabaseTimed(
      "families · daily_new_words",
      `/rest/v1/families?id=eq.${fid}&select=daily_new_words`
    );
    const r2 = await supabaseTimed(
      "families · selected_banks",
      `/rest/v1/families?id=eq.${fid}&select=selected_banks`
    );
    const r3 = await supabaseTimed(
      "families · pronunciation_pref",
      `/rest/v1/families?id=eq.${fid}&select=pronunciation_pref`
    );
    rows.push(r1, r2, r3);

    const rCountCustom = await supabaseTimed(
      "words · count（自定义词，HEAD）",
      `/rest/v1/words?family_id=eq.${fid}&select=id`,
      "HEAD",
      { Prefer: "count=exact" }
    );
    rows.push(rCountCustom);

    const rWordsPage = await supabaseTimed(
      "words · 摘要列表第 1 页（同 getAllWordsSummary）",
      `/rest/v1/words?family_id=eq.${fid}&select=id,word,phonetic,uk_phonetic,progress(correct_count,wrong_count,stage)&order=created_at.desc`,
      "GET",
      { Range: "0-999" }
    );
    rows.push(rWordsPage);

    // 读取 selected_banks 以决定测哪些 bank_words count（与前端逻辑一致）
    let banks = ["custom"];
    try {
      const bRes = await fetch(`${SUPABASE_URL}/rest/v1/families?id=eq.${fid}&select=selected_banks`, {
        headers: supabaseHeaders(),
      });
      const bJson = await bRes.json();
      banks = bJson?.[0]?.selected_banks || ["custom"];
    } catch {
      /* use default */
    }

    const bankIds = banks.filter((b) => b !== "custom");
    for (const bankId of bankIds.slice(0, 3)) {
      rows.push(
        await supabaseTimed(
          `bank_words · count（${bankId}，HEAD）`,
          `/rest/v1/bank_words?bank_id=eq.${encodeURIComponent(bankId)}&select=id`,
          "HEAD",
          { Prefer: "count=exact" }
        )
      );
    }
    if (bankIds.length > 3) {
      notes.push(`仅对前 3 个预置词库做了 bank_words count 探测；当前共选中 ${bankIds.length} 个预置库。`);
    }

    const rBankFirst = bankIds.length
      ? await supabaseTimed(
          `bank_words · 第 1 页（${bankIds[0]}，键集分页首屏）`,
          `/rest/v1/bank_words?bank_id=eq.${encodeURIComponent(bankIds[0])}&select=id,bank_id,word,us_phonetic,uk_phonetic&order=word.asc&limit=1000`
        )
      : null;
    if (rBankFirst) rows.push(rBankFirst);

    const rProg = bankIds.length
      ? await supabaseTimed(
          "progress · bank_word 进度第 1 页",
          `/rest/v1/progress?family_id=eq.${fid}&bank_word_id=not.is.null&select=id,bank_word_id,correct_count,wrong_count,stage`,
          "GET",
          { Range: "0-999" }
        )
      : null;
    if (rProg) rows.push(rProg);

    // 模拟首屏 Promise.all：3 个 family 字段 + 与 loadWords 同结构的并行（count custom + 若多库则多个 count 可并行，此处简化为与前端相近的批）
    const parallelStart = performance.now();
    await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/families?id=eq.${fid}&select=daily_new_words`, { headers: supabaseHeaders() }).then((r) => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/families?id=eq.${fid}&select=selected_banks`, { headers: supabaseHeaders() }).then((r) => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/families?id=eq.${fid}&select=pronunciation_pref`, { headers: supabaseHeaders() }).then((r) => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/words?family_id=eq.${fid}&select=id`, {
        method: "HEAD",
        headers: { ...supabaseHeaders(), Prefer: "count=exact" },
      }),
      fetch(`${SUPABASE_URL}/rest/v1/words?family_id=eq.${fid}&select=id,word,phonetic,uk_phonetic,progress(correct_count,wrong_count,stage)&order=created_at.desc`, {
        headers: { ...supabaseHeaders(), Range: "0-999" },
      }).then((r) => r.arrayBuffer()),
      ...(bankIds.slice(0, 3).map((bid) =>
        fetch(`${SUPABASE_URL}/rest/v1/bank_words?bank_id=eq.${encodeURIComponent(bid)}&select=id`, {
          method: "HEAD",
          headers: { ...supabaseHeaders(), Prefer: "count=exact" },
        })
      )),
    ]);
    const parallelWallMs = Math.round((performance.now() - parallelStart) * 100) / 100;
    notes.push(
      `模拟「进入家长页」Supabase 并行一批（3×families + words count + words 摘要首页 + 至多 3 个 bank count）墙钟时间：**${parallelWallMs} ms**（受最慢请求支配）。`
    );
  }

  const md = buildMarkdown(rows, notes, familyId);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, md, "utf8");
  console.log(md);
  console.error(`\n已写入: ${OUT}`);
}

function buildMarkdown(rows, notes, familyId) {
  const when = new Date().toISOString();
  let s = `# 家长页相关接口耗时报告\n\n`;
  s += `- **站点**: \`${BASE_URL}/parent\`\n`;
  s += `- **生成时间**: ${when} (UTC)\n`;
  s += `- **Runner**: Node ${process.version}\n`;
  if (familyId) s += `- **基准家庭 id**: \`${familyId}\`（来自 .env 口令或 BENCHMARK_FAMILY_ID）\n`;
  s += `\n## 说明\n\n`;
  s += `- 耗时为「发起请求 → 读完响应体」的总时间（含 TLS、DNS、Netlify/Supabase 处理与下载）。\n`;
  s += "- 有道请求走 Netlify `/youdao-api/*` 代理，与线上 `lookupWord` 一致。\n";
  s += `- 词库 JSON 为单文件体积较大的静态资源；全量下载时间可反映 CDN/边缘缓存情况。\n`;
  s += "- Supabase 请求使用 PostgREST，与 `supabase-js` 客户端发出的 HTTP 一致（匿名角色 + RLS）。\n";
  if (notes.length) {
    s += `\n### 备注\n\n`;
    for (const n of notes) s += `- ${n}\n`;
  }

  s += `\n## 结果汇总\n\n`;
  s += `| 名称 | 方法 | HTTP | 耗时 (ms) | 字节数 | 备注 |\n`;
  s += `|------|------|------|-----------|--------|------|\n`;
  for (const r of rows) {
    const note = r.err ? r.err : r.ok ? "—" : "非 2xx";
    s += `| ${r.name} | ${r.method} | ${r.status || "—"} | ${r.ms} | ${r.bytes} | ${note} |\n`;
  }

  s += `\n## 原始 URL（便于复制复测）\n\n`;
  for (const r of rows) {
    s += `- **${r.name}**\n\n`;
    s += `  \`\`\`text\n  ${r.url}\n  \`\`\`\n\n`;
  }

  return s;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
