# WordPop 开发日志

## 项目概述

WordPop 是一个面向家长和孩子的英语单词学习 Web 应用。家长添加单词，孩子通过闯关测试来记忆。

**技术栈**: React + Vite + Supabase + Netlify

---

## 功能演进

### 第一阶段：基础功能搭建

- 家长入口：输入单词自动查词典获取释义、音标、例句、配图，支持编辑后保存
- 学生入口：认识新单词（翻转卡片）、闯关测试（中→英 / 英→中 / 拼写 / 连连看）、错题重考
- 多用户：口令登录，家庭隔离数据，邀请链接注册
- 每日打卡日历

### 第二阶段：发音与音标

- 接入有道词典 API 获取英式/美式音标
- 做题时自动播放美音
- 家长预览和单词详情页显示英美双音标 + 发音按钮
- 牛津例句支持

### 第三阶段：记忆算法与数据可视化

- **艾宾浩斯遗忘曲线复习间隔**：`[1, 2, 4, 7, 15, 30]` 天
- **错误率优先复习**：`errorWeight = 1 + errorRate * 2`，全错的词优先级是普通词的 3 倍
- **单词卡片可视化**：
  - 红绿比例条铺满整个卡片背景（绿=正确，红=错误）
  - Badge 显示错误率（"全对"/"错30%"/"待测试"）
  - 展开后显示详细统计（做题次数、正确/错误数、正确率）
- **筛选器**：全部 / 待测试 / 已测试，按是否有做题记录区分

### 第四阶段：出题策略优化

- **题数固定为 5/10/15/20 档**，取可用词数能支撑的最高档
- 5 个新词 + 最多 15 个复习词（按遗忘曲线+错误率排序）
- API 多返回复习词（最多 25 个），为连连看留余量
- **连连看作为普通题型随机出现**，不强制额外加题
  - 只在词池有 3 个以上富余时才可能出（25% 概率）
  - 4 个词算 1 题，不会挤占题数

### 第五阶段：额外学习模式

- 今日已打卡后，日历 hover 显示"多背几个"气泡
- 点击进入额外学习模式（`?extra=1`）
- 额外模式排除今天已作为新词测过的词，但复习池包含今天测过的词

### 第六阶段：UI 重设计

- **做题顶栏**：实时 ✓/✗ 药丸计数 + 题号 + 重考标签
- **渐变进度条**：紫→淡紫
- **题卡**：圆角 16px 卡片 + 阴影，紫色题型徽章，词性和听发音分行排列
- **选项**：A/B/C/D 圆形字母标识，正确变绿/错误变红
- **结果页**：SVG 环形进度图 + 正确/错误/总数三栏统计 + 红绿比例条
- **Emoji 替换 SVG**：📖 家长 / 🎮 学生 / 🔊 发音 / 🏆👍💪 成绩

---

## 踩坑记录

### 1. Supabase 一对一关系返回对象而非数组

**问题**：`words` 表通过 `progress(*)` 查询关联数据，代码用 `w.progress?.[0]?.correct_count` 取值，但 Supabase 对一对一外键关系返回的是单个对象 `{}` 而不是数组 `[{}]`，导致永远取到 `undefined`。

**表现**：单词卡片永远显示"待测试"，背景色不变。

**解决**：
```js
const prog = Array.isArray(w.progress) ? w.progress[0] : w.progress;
const correct = prog?.correct_count || 0;
```

### 2. React useEffect 音频重复播放

**问题**：进入做题页面时，第一题的音频会播放两次或播放错误单词的音频。

**原因**：
- `useEffect` 依赖 `[qIdx, loading]`，`loading` 变化和 `questions` 设置可能触发多次 effect
- React StrictMode 在开发模式下双重执行 effect
- `currentQ` 闭包可能捕获旧值

**解决**：用 `useRef` 记录已播放的 key，同一个 `qIdx + word` 组合只播放一次：
```js
const lastPlayedRef = useRef("");
useEffect(() => {
  const key = `${qIdx}-${q.word.word}`;
  if (lastPlayedRef.current === key) return;
  lastPlayedRef.current = key;
  setTimeout(() => playAudio(q.word.word, 2), 300);
}, [questions, qIdx]);
```

### 3. 复习选词逻辑 bug

**问题**：每次做题只有 5 个新词 + 1 个连连看 = 6 题，复习词永远是 0。

**原因**：`reviewCount = Math.min(15, pastDates.size * 5)`，第一天 `pastDates` 为空（size=0），所以 `reviewCount = 0`。

**解决**：去掉基于历史天数的计算，直接取 `Math.min(15, reviewPool.length)`。

### 4. 连连看额外加题

**问题**：20 个词生成 20 道普通题 + 1 道连连看 = 21 题。

**解决**：连连看的 4 个词从词池中扣除（它们不再单独出题），保证总题数 = 词数。后续改为连连看随机出现，词池有 3 个以上余量时 25% 概率触发。

### 5. extra 模式复习池为空

**问题**：额外学习模式下，今天考过的词被从整个 available 池排除，导致复习池也为空。

**解决**：只从新词池排除今天考过的词，复习池保留所有测试过的词，由优先级排序决定选谁。

---

## 数据库结构

| 表 | 用途 | 关键字段 |
|---|---|---|
| `families` | 家庭/用户 | `id`, `pin`, `invite_token` |
| `words` | 单词 | `id`, `word`, `phonetic`, `uk_phonetic`, `family_id` |
| `meanings` | 释义 | `word_id`, `pos`, `meaning_cn`, `example`, `example_cn` |
| `progress` | 学习进度 | `word_id`, `correct_count`, `wrong_count`, `stage`, `last_quiz_at` |
| `quiz_log` | 做题记录 | `word_id`, `meaning_id`, `quiz_type`, `is_correct`, `created_at` |
| `checkins` | 打卡 | `check_date`, `family_id` |

---

## 记忆算法

### 复习间隔（艾宾浩斯）

```
第1次测试后 → 1天后复习
第2次 → 2天
第3次 → 4天
第4次 → 7天（1周）
第5次 → 15天（2周）
第6次+ → 30天（1月）
```

### 复习优先级

```
timePriority = daysSince / idealInterval  // 超期程度
errorRate = wrong / total                  // 错误率
errorWeight = 1 + errorRate * 2            // 错误权重(1~3)
priority = timePriority * errorWeight      // 最终优先级
```

优先级最高的词先被选入复习池。

### 出题数量

| 可用词数 | 题数 |
|---------|------|
| < 5     | 实际词数 |
| 5-9     | 5 |
| 10-14   | 10 |
| 15-19   | 15 |
| 20+     | 20 |

---

## 文件结构

```
src/
├── App.jsx              # 路由
├── main.jsx             # 入口
├── index.css            # 全局样式
├── components/
│   ├── Confetti.jsx     # 撒花动画
│   └── Icons.jsx        # SVG 图标
├── lib/
│   ├── api.js           # 核心 API（查词、保存、出题、记录）
│   ├── family.js        # 家庭/登录管理
│   └── supabase.js      # Supabase 客户端
└── pages/
    ├── HomePage.jsx     # 首页（登录+入口选择）
    ├── ParentPage.jsx   # 家长管理（查词、单词列表、统计）
    ├── ChildPage.jsx    # 学生首页（日历打卡）
    ├── QuizPage.jsx     # 做题页
    └── InvitePage.jsx   # 邀请注册页
```
