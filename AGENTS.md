# AGENTS.md

## 开发流程（铁律）

1. **先做规划**：收到需求后，先制定开发方案和计划，不得直接动手写代码。
2. **讨论确认**：将规划方案与用户讨论，形成关键开发点供用户 review。
3. **用户通过后实现**：只有用户明确通过关键开发点后，才可以开始编码实现。
4. **用户验证**：实现完成后交由用户验证和修改，不得自行判定完成。
5. **用户说通过才通过**：只有用户明确说"通过"时，该任务才算完成。

## 部署规则（铁律）

- **禁止自动部署**：修改完代码后，不得自动执行 `git push` 或任何部署操作。
- **本地 review 优先**：所有改动完成后，先告知用户，等待用户本地检查确认。
- **用户指令部署**：只有在用户明确说"部署"时，才可以执行 `git push` 进行部署。

## 词库功能规划（第一期）

### 确定做的词库（11 个）

**有道 API 直接可用（8 个）：**

| 词库 | 有道 ID | 词数 |
|------|---------|------|
| CET-4 | CET4luan_2 | 3,739 |
| CET-6 | CET6_2 | 2,078 |
| TOEFL | TOEFL_2 | 9,213 |
| IELTS | IELTSluan_2 | 3,427 |
| GRE | GRE_2 | 7,199 |
| SAT | SAT_2 | 4,423 |
| GMAT | GMATluan_2 | 3,254 |
| BEC | BEC_2 | 2,753 |

**剑桥官网 PDF 解析（2 个）：**

| 词库 | 词数 |
|------|------|
| KET | ~1,500 |
| PET | ~3,300 |

**用户自定义（1 个）：** 现有逐词添加功能即为自定义词库。

### 每日新词学习（待定入口）

- **需求**：做题前先学习当日 5 个新词（即 `getQuizWords` 返回的前 5 个 `_isNew` 词），逐个展示完整词卡（单词、音标、发音、全部释义+词性、例句+中文翻译），用户浏览后点下一个。
- **定位**：非必选项，不影响每日打卡判定，纯学习辅助。
- **待确定**：入口方式（需对 iPad 触屏友好）。

### 收费方案

- **触发条件**：每个口令码（family）导入的单词总数超过 100 个时，需要付费才能继续导入（含批量导入和手动逐词导入）。
- **免费额度**：每个口令码前 100 个词免费。
- **支付方式**：微信支付商业收款码（个体工商户），不接 API，用户扫码付款后手动/半自动解锁额度。
- **待确定**：收费模式（一次性买断 / 订阅 / 按词量阶梯计费）、具体价格。

#### 技术实现思路

**当前阶段（无流量）**：手动方案
1. 数据库加字段：`families` 表增加 `word_limit`（默认 100）、`is_paid`（是否付费）。
2. 前端：导入时检查当前词数 vs `word_limit`，超限弹出付费引导页（展示收款码图片 + 说明）。
3. 后端：用户付款后，管理员手动在数据库中更新 `word_limit` / `is_paid`。

**有流量后升级**：方案 A — 国内服务器中转自动解锁
1. 买阿里云/腾讯云轻量服务器（~50 元/年），做 ICP 备案。
2. 部署极简支付回调接口，接收微信支付成功通知。
3. 回调接口自动写 Supabase 解锁用户额度。
4. 主站仍部署 Netlify，不用迁移。

### 口令安全防护（待流量上来后实施）

- **方案 A**：强制口令最低 6 位，字母+数字混合，提高猜中难度
- **方案 C**：移除邀请页实时口令检测（`checkPinAvailable`），避免枚举攻击
- **方案 B**：登录限频 + 锁定（同设备/IP 连续错 5 次锁 15 分钟，需 Netlify Function 中转）

### 暂不做的词库

FCE、CAE、CPE、ACT、PTE — 无现成公开机器可读词库，后续有数据源再扩展。

## 变更记录规则

- **每次修改后**，需将本次改动的要点归纳总结，追加到下方「变更记录」章节中。
- 格式：`日期 - 简要描述改动内容及涉及的文件`。

## 变更记录

- 2026-03-01 - 新增变更记录规则，要求每次修改后在 `AGENTS.md` 中归纳总结改动点。
- 2026-03-01 - 前五题（新词）增加拼写考核：选择题完成后在同一题卡下方出现拼写输入框，选择+拼写均正确才算该题通过。涉及文件：`src/lib/api.js`（标记新词 `_isNew`）、`src/pages/QuizPage.jsx`（buildQuestions 分离新词/复习词、新增 `handleNewWordSpell` 和两阶段答题状态）、`src/index.css`（新词拼写区域样式）。
- 2026-03-01 - 全局间距优化：`.pos-tag` 内边距从 2px→4px 并移除通用 margin-bottom（仅块级上下文保留）；`.quiz-meta` gap 10→12px；`.spell-meaning-item` gap 8→10px；`.phonetic-item` gap 4→6px；`.quiz-label` margin-bottom 4→12px；`.word-item-meaning p` margin 2→4px；`.example` margin-top 4→6px。涉及文件：`src/index.css`。
- 2026-03-01 - 前五题（新词）题型改为固定的 `newSpell`：显示中文释义 + 音标 + 发音按钮，学生直接拼写。移除了之前的选择+拼写两阶段逻辑（`newWordSpellActive`/`choiceCorrect`/`spellResult`/`handleNewWordSpell`），大幅简化代码。涉及文件：`src/pages/QuizPage.jsx`（buildQuestions、handleAnswer、UI 渲染）、`src/index.css`（清理旧样式）。
- 2026-03-01 - 拼写题词卡对齐优化：`.spell-meaning-item` 使用 flex + pos-tag `min-width: 80px` 固定列宽，词性标签列等宽居中、释义列统一左对齐。涉及文件：`src/index.css`。
- 2026-03-01 - 中选英（cn2en）题目进入时不再自动播放发音，避免提示答案。涉及文件：`src/pages/QuizPage.jsx`。
- 2026-03-01 - 中选英题干移除词性标签（noun/adjective 等英文）和发音按钮，避免泄露提示。涉及文件：`src/pages/QuizPage.jsx`。
- 2026-03-01 - 所有需要拼写的题型（cn2en、spell、newSpell）释义中若包含英文原词，自动替换为 `____` 遮盖，防止泄露答案。新增 `maskWord` 工具函数。涉及文件：`src/pages/QuizPage.jsx`。
- 2026-03-01 - 移除题目中所有小喇叭图标：en2cn 点击单词发音、cn2en 点击选项发音、spell/newSpell 点击音标发音（新增 `.phonetic-clickable` 样式），答题结果中点击单词发音。移除 `SpeakerIcon` 导入。涉及文件：`src/pages/QuizPage.jsx`、`src/index.css`。
- 2026-03-04 - 拼写题（spell/newSpell）改为单输入框 + 防输入法候选词提示：使用 `autoComplete="one-time-code"` / `autoCorrect="off"` / `autoCapitalize="off"` / `spellCheck={false}` / `data-form-type="other"` 组合属性彻底禁止系统输入提示。正确时输入框变绿，错误时输入框变红+震动并显示正确答案。移除了之前的 LetterBoxes 逐字母组件。涉及文件：`src/pages/QuizPage.jsx`、`src/index.css`。
- 2026-03-04 - 连连看改为全部连完后统一判定：配对时仅标灰（`.linked`），不即时判对错；全部配完后延迟 350ms 统一判定，正确的变绿（`.correct`），错误的变红+震动（`.wrong`），再延迟 1.2s 后进入下一题。涉及文件：`src/pages/QuizPage.jsx`（MatchGame 重写）、`src/index.css`（新增 `.linked`/`.correct` 状态样式）。
- 2026-03-08 - 新增「开发流程（铁律）」章节：规划→讨论→用户通过→实现→用户验证→用户说通过才通过，五步流程。涉及文件：`AGENTS.md`。
- 2026-03-08 - 新增「词库功能规划（第一期）」章节：确定 11 个词库（有道 API 8 个 + 剑桥 PDF 2 个 + 用户自定义 1 个），暂不做 FCE/CAE/CPE/ACT/PTE。涉及文件：`AGENTS.md`。
- 2026-03-08 - 完成 10 个预置词库数据准备：有道背单词 API 下载 8 个词库 zip 包（CET-4/CET-6/TOEFL/IELTS/GRE/SAT/GMAT/BEC）解析 JSONL 生成结构化 JSON；剑桥官网下载 KET/PET PDF 词表，已有词库数据交叉复用 + 有道 API 并发补全。共 40,535 词，存储于 `data/word-banks/` 目录（10 个 JSON 文件）。
- 2026-03-08 - 实现词库导入与批量添加功能（Combobox 统一输入方案）。新增文件：`src/components/WordBankPanel.jsx`（词库选择面板，按分类展示 10 个预置词库，支持搜索/预览/一键导入）、`src/components/ImportProgress.jsx`（异步导入进度条组件 + `useImportTask` hook，后台逐批保存不阻塞 UI）、`netlify/functions/batch-lookup.js`（后端批量查词函数，生产环境可用）。修改文件：`src/lib/api.js`（新增 `batchLookupWords` 前端批量查词：优先从 10 个词库 JSON 缓存命中，未命中词走有道 API 逐个查询）、`src/pages/ParentPage.jsx`（输入框升级为 Combobox：自动检测单词/批量/词库模式，单词回车查询、多词换行或逗号分隔批量查询、▼ 按钮打开词库面板）、`src/index.css`（Combobox/词库面板/批量预览/进度条全套样式）、`netlify.toml`（添加 `included_files` 配置）、`vite.config.js`（清理）。词库 JSON 从 `data/word-banks/` 迁移到 `public/data/word-banks/` 供前端直接访问。
- 2026-03-08 - 导入任务全局化：将 `ImportProgress` 从组件级状态改为模块级单例（`useSyncExternalStore` + 模块变量），导入任务在页面切换后仍持续运行；进度条从 `ParentPage` 移至 `App.jsx` 顶层渲染（`position: sticky`），任何页面均可见。涉及文件：`src/components/ImportProgress.jsx`（重写为全局单例：`startGlobalImport`/`cancelGlobalImport`/`clearGlobalImport`/`useGlobalImportTask`）、`src/App.jsx`（顶层渲染 `ImportProgress`）、`src/pages/ParentPage.jsx`（改用全局 API，移除本地进度条）、`src/index.css`（进度条 `sticky` 定位 + 阴影）。
- 2026-03-08 - 新增每日新词学习页面 + 学生页日历泡泡入口。新增文件：`src/pages/LearnPage.jsx`（逐个展示当日 5 个新词完整词卡：单词点击发音、UK/US 音标、全部释义+词性、例句+中文翻译；底部按钮前 4 词为「下一个 →」、最后 1 词为「开始测测 ✏️」跳转做题页；支持 `extra` 参数获取新一批词）。修改文件：`src/App.jsx`（添加 `/child/learn` 路由）、`src/pages/ChildPage.jsx`（今日格子点击变形为「学学」「测测」两个按钮，已完成今日任务时传 `extra=1` 获取新词）、`src/index.css`（LearnPage 全套样式：进度条、词卡、音标、释义卡片、例句、固定底部按钮；日历泡泡按钮样式）。
- 2026-03-08 - 修复测测与学学新词不一致 bug：QuizPage 的 `sessionStorage` 做题缓存没有日期校验，数据库重置后恢复了旧缓存数据导致显示了非当日新词（如 "low"）。修复方案：`saveQuizProgress` 写入 `_date` 字段，`loadQuizProgress` 恢复时校验日期，非当天缓存直接丢弃。涉及文件：`src/pages/QuizPage.jsx`。
- 2026-03-09 - 每日新词数量由家长可配置（5–30，步进1）。数据库：`families` 表新增 `daily_new_words` 列（integer, 默认5, CHECK 5–30）。新增迁移文件：`supabase-migration-daily-new-words.sql`。修改文件：`src/lib/api.js`（`getQuizWords` 从 family 读取 `daily_new_words` 替换硬编码 5）、`src/lib/family.js`（新增 `getDailyNewWords` / `updateDailyNewWords`）、`src/pages/ParentPage.jsx`（页面顶部新增滑块设置控件，粉色渐变填充+拖动提示语）、`src/index.css`（设置区域样式）、`supabase-reset-and-seed.sql`（同步新字段）。
- 2026-03-09 - 邀请链接 30 分钟过期：`families` 表新增 `invite_token_expires_at` 列。`getInviteToken` 改为每次生成新 token + 设置 30 分钟过期时间；`createFamilyFromInvite` 校验过期时间，过期返回错误提示。涉及文件：`src/lib/family.js`、`supabase-reset-and-seed.sql`。
- 2026-03-09 - 词库多选重构：新建共享 `bank_words` 表（10 个预置词库约 40K 词只存一份，所有家庭复用），`families` 表新增 `selected_banks`（jsonb, 默认 `["custom"]`）。`progress`/`quiz_log` 表新增 `bank_word_id` 列支持双来源。新增文件：`supabase-migration-bank-words.sql`（迁移 SQL）、`scripts/import-bank-words.mjs`（JSON→bank_words 导入脚本）。重构文件：`src/lib/api.js`（`getQuizWords` 根据 `selected_banks` 合并 words+bank_words 两个词池；`recordQuiz`/`updateMasteryStatus` 兼容 word_id/bank_word_id 双来源；新增 `normalizeBankWord` 将 bank_word 行转为前端统一格式）、`src/lib/family.js`（新增 `getSelectedBanks`/`updateSelectedBanks`）、`src/pages/QuizPage.jsx`（`wordId` 改为 `wordObj` 传递完整 word 对象以区分来源）、`src/pages/ParentPage.jsx`（移除 ▼ 下拉词库面板，改为词库标签平铺多选 UI，"我的词库"并列于预置词库，选中变紫色；输入框仅用于添加自定义词）、`src/index.css`（新增 `.bank-selector`/`.bank-tag` 样式）。移除 `WordBankPanel` 组件的引用。
- 2026-03-09 - 英美拼法差异处理：去重 + 拼写兼容 + 词卡提示。去重：扫描全部 10 个词库发现 16 对英美拼法重复词条，英式考试保留英式、美式考试保留美式，删除 16 条冗余记录。拼写兼容：新增规则引擎覆盖 12 类英美差异模式，拼写题自动接受两种拼法。词卡提示：有英美拼法变体的词在词卡下方显示"也拼作 xxx（美式/英式）"。抽取共享工具 `src/lib/spelling.js`（`isSpellingVariant` 宽松规则用于答题判定 + `getSpellingVariant` 保守策略用于词卡提示：精选映射表覆盖 70+ 常见对 + 生产性 -ise/-ize 规则带例外黑名单）。涉及文件：`src/lib/spelling.js`（新增）、`src/pages/QuizPage.jsx`（导入 spelling.js，拼写题结果区显示变体提示）、`src/pages/LearnPage.jsx`（词卡标题下显示变体提示）、`src/index.css`（`.spelling-variant-hint` 样式）、数据库 `bank_words` 表（删除 16 条记录）。
- 2026-03-09 - 修复 KET/PET 词库 83 条数据质量问题。问题源于剑桥 PDF 解析错误：词名断裂（如 `attentio n`→`attention`）、多词误合并（如 `class  homework  practise` 被合为一条）、音标/例句/释义与词名完全错位（如 `text message` 拿到了 `treason` 的数据）。修复方案：① 3 条多词合并条目拆分后删除（其中 `babysitter`/`employ` 新建）；② 80 条单词修正词名 + 通过有道 suggest API / 手动构造补全释义、音标、例句；③ 最终验证 40,518 条词全部有中文释义。涉及：数据库 `bank_words` 表（83 条记录修复）。
- 2026-03-09 - 发音偏好 switch + 英美拼法词条合并。**发音偏好**：数据库 `families` 表新增 `pronunciation_pref` 列（text, 默认 `'us'`，可选 `'uk'`/`'us'`）；家长页新增 🇺🇸美音/🇬🇧英音 切换按钮，存储到数据库并实时生效；所有页面默认发音（小喇叭点击、进入题目自动播放）改用全局偏好，音标区 UK/US 保留各自固定 type。涉及文件：`src/lib/family.js`（新增 `getPronunciationPref`/`updatePronunciationPref`）、`src/lib/api.js`（新增 `setAudioPref`/`getAudioPref`，`playAudio` 默认 type 改为动态 `_audioPref`，自动处理 `xxx/yyy` 格式取首段）、`src/pages/ParentPage.jsx`（初始化加载偏好、发音 switch UI）、`src/pages/QuizPage.jsx`/`src/pages/LearnPage.jsx`（初始化加载偏好、移除硬编码 `type=2`）、`src/index.css`（`.pron-switch`/`.pron-option`/`.pron-active` 样式）。**英美拼法词条合并**：`bank_words` 表中有英美变体的词统一更新 `word` 字段为 `短/长` 格式（如 `program/programme`、`color/colour`），共 605 条更新（移除 23 类误报后）、删除 6 条因同一词库两种拼法并存的重复记录。前端适配：`maskWord` 遮盖两种形式，拼写题接受任一形式，`playAudio` 取首段发音，搜索 `includes` 天然兼容。移除了之前的"也拼作 xxx（美式/英式）"提示。涉及文件：`src/lib/spelling.js`（新增 `getWordForms`/`toAudioWord`/`toCombinedWord`，扩充 `ISE_EXCEPTIONS` 黑名单 27 词）、`src/pages/QuizPage.jsx`（拼写判定适配 `getWordForms`、移除 `getSpellingVariant` 导入和两处提示）、`src/pages/LearnPage.jsx`（移除 `getSpellingVariant` 导入和提示）。
