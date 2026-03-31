# 家长页相关接口耗时报告

- **站点**: `https://wordpopp.netlify.app/parent`
- **生成时间**: 2026-03-29T02:14:51.648Z (UTC)
- **Runner**: Node v24.7.0

## 说明

- 耗时为「发起请求 → 读完响应体」的总时间（含 TLS、DNS、Netlify/Supabase 处理与下载）。
- 有道请求走 Netlify `/youdao-api/*` 代理，与线上 `lookupWord` 一致。
- 词库 JSON 为单文件体积较大的静态资源；全量下载时间可反映 CDN/边缘缓存情况。
- Supabase 请求使用 PostgREST，与 `supabase-js` 客户端发出的 HTTP 一致（匿名角色 + RLS）。

### 备注

- 未执行 Supabase 分项测试：请在项目根 `.env` 中配置 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_PIN`，或设置环境变量 `BENCHMARK_FAMILY_ID`。

## 结果汇总

| 名称 | 方法 | HTTP | 耗时 (ms) | 字节数 | 备注 |
|------|------|------|-----------|--------|------|
| 文档壳 index.html（任意路由回退） | GET | — | 10539.62 | 0 | fetch failed |
| 有道代理（经 Netlify） | GET | 200 | 9489.91 | 5072 | — |
| 静态词库 JSON（示例 CET4） | GET | 200 | 1256.94 | 1413445 | — |

## 原始 URL（便于复制复测）

- **文档壳 index.html（任意路由回退）**

  ```text
  https://wordpopp.netlify.app/parent
  ```

- **有道代理（经 Netlify）**

  ```text
  https://wordpopp.netlify.app/youdao-api/jsonapi_s?doctype=json&jsonversion=4&le=en&q=hello&dicts=%7B%22count%22%3A99%2C%22dicts%22%3A%5B%5B%22ec%22%2C%22blng_sents_part%22%5D%5D%7D
  ```

- **静态词库 JSON（示例 CET4）**

  ```text
  https://wordpopp.netlify.app/data/word-banks/CET4.json
  ```

