-- ====== WordPop 多家庭支持迁移 ======
-- 请在 Supabase SQL Editor 中执行

-- 1. 创建 families 表
CREATE TABLE families (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pin text UNIQUE NOT NULL,
  invite_token text UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz DEFAULT now()
);

-- 2. 创建第一个家庭（口令 1234，现有数据归到这个家庭）
INSERT INTO families (pin) VALUES ('1234');

-- 3. 各表增加 family_id 列
ALTER TABLE words ADD COLUMN family_id uuid REFERENCES families(id);
ALTER TABLE progress ADD COLUMN family_id uuid REFERENCES families(id);
ALTER TABLE quiz_log ADD COLUMN family_id uuid REFERENCES families(id);
ALTER TABLE checkins ADD COLUMN family_id uuid REFERENCES families(id);

-- 4. 把现有数据迁移到第一个家庭
UPDATE words SET family_id = (SELECT id FROM families LIMIT 1);
UPDATE progress SET family_id = (SELECT id FROM families LIMIT 1);
UPDATE quiz_log SET family_id = (SELECT id FROM families LIMIT 1);
UPDATE checkins SET family_id = (SELECT id FROM families LIMIT 1);

-- 5. 设为 NOT NULL
ALTER TABLE words ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE progress ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE quiz_log ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE checkins ALTER COLUMN family_id SET NOT NULL;

-- 6. 更新唯一约束
ALTER TABLE words DROP CONSTRAINT IF EXISTS words_word_key;
ALTER TABLE words ADD CONSTRAINT words_word_family_unique UNIQUE (word, family_id);

ALTER TABLE checkins DROP CONSTRAINT IF EXISTS checkins_check_date_key;
ALTER TABLE checkins ADD CONSTRAINT checkins_family_date_unique UNIQUE (family_id, check_date);
