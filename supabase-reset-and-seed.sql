-- ====== 清库 + 建表 + 灌数据 ======

-- 1. 清空所有数据
TRUNCATE quiz_log, checkins, progress, meanings, words CASCADE;
DROP TABLE IF EXISTS families CASCADE;

-- 2. 创建 families 表
CREATE TABLE families (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pin text UNIQUE NOT NULL,
  invite_token text UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz DEFAULT now()
);

-- 3. 给各表加 family_id（如果还没加过）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='words' AND column_name='family_id') THEN
    ALTER TABLE words ADD COLUMN family_id uuid REFERENCES families(id);
  ELSE
    ALTER TABLE words DROP CONSTRAINT IF EXISTS words_family_id_fkey;
    ALTER TABLE words ADD CONSTRAINT words_family_id_fkey FOREIGN KEY (family_id) REFERENCES families(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='progress' AND column_name='family_id') THEN
    ALTER TABLE progress ADD COLUMN family_id uuid REFERENCES families(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quiz_log' AND column_name='family_id') THEN
    ALTER TABLE quiz_log ADD COLUMN family_id uuid REFERENCES families(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='checkins' AND column_name='family_id') THEN
    ALTER TABLE checkins ADD COLUMN family_id uuid REFERENCES families(id);
  END IF;
END $$;

-- 4. 更新约束
ALTER TABLE words DROP CONSTRAINT IF EXISTS words_word_key;
ALTER TABLE words DROP CONSTRAINT IF EXISTS words_word_family_unique;
ALTER TABLE words ADD CONSTRAINT words_word_family_unique UNIQUE (word, family_id);

ALTER TABLE checkins DROP CONSTRAINT IF EXISTS checkins_check_date_key;
ALTER TABLE checkins DROP CONSTRAINT IF EXISTS checkins_family_date_unique;
ALTER TABLE checkins ADD CONSTRAINT checkins_family_date_unique UNIQUE (family_id, check_date);

-- 5. 创建家庭，口令 1234
INSERT INTO families (pin) VALUES ('1234');

-- 6. 灌测试单词（words.id 是 uuid 类型）
DO $$
DECLARE
  fid uuid;
  wid uuid;
BEGIN
  SELECT id INTO fid FROM families WHERE pin = '1234';

  INSERT INTO words (word, phonetic, image_url, family_id) VALUES ('apple', '/ˈæp.əl/', '', fid) RETURNING id INTO wid;
  INSERT INTO meanings (word_id, pos, meaning_cn) VALUES (wid, 'noun', '1. 苹果\n2. 苹果树');
  INSERT INTO progress (word_id, stage, next_review_at, family_id) VALUES (wid, 'reserve', now(), fid);

  INSERT INTO words (word, phonetic, image_url, family_id) VALUES ('book', '/bʊk/', '', fid) RETURNING id INTO wid;
  INSERT INTO meanings (word_id, pos, meaning_cn) VALUES (wid, 'noun', '1. 书\n2. 书籍\n3. 本子');
  INSERT INTO meanings (word_id, pos, meaning_cn) VALUES (wid, 'verb', '1. 预订\n2. 登记');
  INSERT INTO progress (word_id, stage, next_review_at, family_id) VALUES (wid, 'reserve', now(), fid);

  INSERT INTO words (word, phonetic, image_url, family_id) VALUES ('cat', '/kæt/', '', fid) RETURNING id INTO wid;
  INSERT INTO meanings (word_id, pos, meaning_cn) VALUES (wid, 'noun', '猫');
  INSERT INTO progress (word_id, stage, next_review_at, family_id) VALUES (wid, 'reserve', now(), fid);

  INSERT INTO words (word, phonetic, image_url, family_id) VALUES ('dog', '/dɔːɡ/', '', fid) RETURNING id INTO wid;
  INSERT INTO meanings (word_id, pos, meaning_cn) VALUES (wid, 'noun', '狗');
  INSERT INTO progress (word_id, stage, next_review_at, family_id) VALUES (wid, 'reserve', now(), fid);

  INSERT INTO words (word, phonetic, image_url, family_id) VALUES ('happy', '/ˈhæp.i/', '', fid) RETURNING id INTO wid;
  INSERT INTO meanings (word_id, pos, meaning_cn) VALUES (wid, 'adjective', '1. 快乐的\n2. 幸福的\n3. 满意的');
  INSERT INTO progress (word_id, stage, next_review_at, family_id) VALUES (wid, 'reserve', now(), fid);

  INSERT INTO words (word, phonetic, image_url, family_id) VALUES ('run', '/rʌn/', '', fid) RETURNING id INTO wid;
  INSERT INTO meanings (word_id, pos, meaning_cn) VALUES (wid, 'verb', '1. 跑\n2. 奔跑\n3. 运行');
  INSERT INTO meanings (word_id, pos, meaning_cn) VALUES (wid, 'noun', '1. 跑步\n2. 运转');
  INSERT INTO progress (word_id, stage, next_review_at, family_id) VALUES (wid, 'reserve', now(), fid);

  INSERT INTO words (word, phonetic, image_url, family_id) VALUES ('water', '/ˈwɔː.tər/', '', fid) RETURNING id INTO wid;
  INSERT INTO meanings (word_id, pos, meaning_cn) VALUES (wid, 'noun', '水');
  INSERT INTO meanings (word_id, pos, meaning_cn) VALUES (wid, 'verb', '浇水');
  INSERT INTO progress (word_id, stage, next_review_at, family_id) VALUES (wid, 'reserve', now(), fid);

  INSERT INTO words (word, phonetic, image_url, family_id) VALUES ('beautiful', '/ˈbjuː.tɪ.fəl/', '', fid) RETURNING id INTO wid;
  INSERT INTO meanings (word_id, pos, meaning_cn) VALUES (wid, 'adjective', '1. 美丽的\n2. 漂亮的\n3. 出色的');
  INSERT INTO progress (word_id, stage, next_review_at, family_id) VALUES (wid, 'reserve', now(), fid);

  INSERT INTO words (word, phonetic, image_url, family_id) VALUES ('school', '/skuːl/', '', fid) RETURNING id INTO wid;
  INSERT INTO meanings (word_id, pos, meaning_cn) VALUES (wid, 'noun', '1. 学校\n2. 上学\n3. 学派');
  INSERT INTO progress (word_id, stage, next_review_at, family_id) VALUES (wid, 'reserve', now(), fid);

  INSERT INTO words (word, phonetic, image_url, family_id) VALUES ('friend', '/frend/', '', fid) RETURNING id INTO wid;
  INSERT INTO meanings (word_id, pos, meaning_cn) VALUES (wid, 'noun', '1. 朋友\n2. 友人');
  INSERT INTO progress (word_id, stage, next_review_at, family_id) VALUES (wid, 'reserve', now(), fid);

END $$;

-- 7. 设 NOT NULL
ALTER TABLE words ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE progress ALTER COLUMN family_id SET NOT NULL;
DO $$
BEGIN
  ALTER TABLE quiz_log ALTER COLUMN family_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TABLE checkins ALTER COLUMN family_id SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
