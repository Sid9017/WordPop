-- ====== 共享词库表 + 多词库选择支持 ======
-- 请在 Supabase SQL Editor 中执行

-- 1. 创建共享词库表
CREATE TABLE IF NOT EXISTS bank_words (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_id text NOT NULL,
  word text NOT NULL,
  us_phonetic text,
  uk_phonetic text,
  meanings jsonb NOT NULL DEFAULT '[]',
  UNIQUE (bank_id, word)
);

CREATE INDEX IF NOT EXISTS idx_bank_words_bank ON bank_words(bank_id);
CREATE INDEX IF NOT EXISTS idx_bank_words_word ON bank_words(word);

ALTER TABLE bank_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on bank_words" ON bank_words FOR ALL USING (true) WITH CHECK (true);

-- 2. families 表新增 selected_banks
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS selected_banks jsonb NOT NULL DEFAULT '["custom"]';

-- 3. quiz_log 支持 bank_word_id
ALTER TABLE quiz_log
  ADD COLUMN IF NOT EXISTS bank_word_id uuid REFERENCES bank_words(id) ON DELETE CASCADE;

ALTER TABLE quiz_log
  ALTER COLUMN word_id DROP NOT NULL;

-- 4. progress 支持 bank_word_id
ALTER TABLE progress
  ADD COLUMN IF NOT EXISTS bank_word_id uuid REFERENCES bank_words(id) ON DELETE CASCADE;

ALTER TABLE progress
  ALTER COLUMN word_id DROP NOT NULL;

-- progress 对 bank_word 需要按 family 唯一
CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_bank_word_family
  ON progress(bank_word_id, family_id) WHERE bank_word_id IS NOT NULL;
