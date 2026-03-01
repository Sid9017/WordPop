# AGENTS.md

## 部署规则（铁律）

- **禁止自动部署**：修改完代码后，不得自动执行 `git push` 或任何部署操作。
- **本地 review 优先**：所有改动完成后，先告知用户，等待用户本地检查确认。
- **用户指令部署**：只有在用户明确说"部署"时，才可以执行 `git push` 进行部署。

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
