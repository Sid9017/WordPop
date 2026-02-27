# WordPop - 背单词小应用

面向家长和孩子的背单词 Web 应用。

## 功能

- **家长入口**：输入单词，自动获取释义、翻译和配图
- **孩子入口**：
  - 认识新单词（翻转卡片）
  - 闯关测试（中→英 / 英→中 / 拼写，错题重考）
  - 间隔复习 + 每日打卡

## 技术栈

- React + Vite（前端）
- Supabase（数据库）
- Netlify（部署 + Serverless Functions）
- dictionaryapi.dev（英文词典）
- MyMemory API（英译中）
- Unsplash API（配图）

## 部署步骤

### 1. Supabase

1. 创建项目 → 打开 SQL Editor
2. 粘贴执行 `supabase-schema.sql`
3. 记下 Project URL 和 anon key

### 2. Unsplash

1. 注册 https://unsplash.com/developers
2. 创建应用，获取 Access Key

### 3. Netlify

1. 连接 GitHub 仓库
2. Build command: `npm run build`
3. Publish directory: `dist`
4. 添加环境变量：

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_PARENT_PIN=1234
VITE_CHILD_PIN=0000
UNSPLASH_ACCESS_KEY=xxx
```

### 本地开发

```bash
cp .env.example .env
# 填入真实的值
npm install
npm run dev
```
