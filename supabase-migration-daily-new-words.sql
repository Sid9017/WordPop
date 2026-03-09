-- ====== 新增每日新词数量配置 ======
-- 请在 Supabase SQL Editor 中执行

ALTER TABLE families
  ADD COLUMN IF NOT EXISTS daily_new_words integer NOT NULL DEFAULT 5
  CHECK (daily_new_words >= 5 AND daily_new_words <= 30);
