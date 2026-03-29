-- 家长页「已添加单词」：服务端合并自定义词 + 多词库 bank_words（与前端原逻辑一致），分页与筛选一次完成。
-- 在 Supabase SQL Editor 中执行整段。

ALTER TABLE words ADD COLUMN IF NOT EXISTS uk_phonetic text;

-- 与 api.js 中 merge 规则一致：先自定义词（created_at 降序），再按 selected_banks 顺序逐库、库内按 word 升序，跨库按词去重（先出现的库优先）；与自定义同词则丢弃预置库行。

CREATE OR REPLACE FUNCTION get_parent_word_list_stats(
  p_family_id uuid,
  p_selected_banks text[]
)
RETURNS TABLE (
  cnt_all bigint,
  cnt_tested bigint,
  cnt_untested bigint,
  bank_counts jsonb
)
LANGUAGE sql
STABLE
AS $$
WITH bank_ord AS (
  SELECT t.bank_id, t.ord::int AS ord
  FROM unnest(p_selected_banks) WITH ORDINALITY AS t(bank_id, ord)
  WHERE t.bank_id IS NOT NULL AND t.bank_id <> 'custom'
),
custom_base AS (
  SELECT
    w.id,
    w.word,
    w.phonetic,
    w.uk_phonetic,
    'custom'::text AS src,
    COALESCE(p.correct_count, 0)::int AS cc,
    COALESCE(p.wrong_count, 0)::int AS wc
  FROM words w
  LEFT JOIN progress p ON p.word_id = w.id AND p.family_id = p_family_id
  WHERE w.family_id = p_family_id
    AND 'custom' = ANY(p_selected_banks)
),
bank_pick AS (
  SELECT
    bw.id,
    bw.word,
    bw.us_phonetic AS phonetic,
    bw.uk_phonetic,
    bw.bank_id AS src,
    COALESCE(pr.correct_count, 0)::int AS cc,
    COALESCE(pr.wrong_count, 0)::int AS wc,
    bo.ord
  FROM bank_words bw
  INNER JOIN bank_ord bo ON bw.bank_id = bo.bank_id
  LEFT JOIN progress pr ON pr.bank_word_id = bw.id AND pr.family_id = p_family_id
),
bank_dedup AS (
  SELECT s.id, s.word, s.phonetic, s.uk_phonetic, s.src, s.cc, s.wc
  FROM (
    SELECT
      bp.*,
      ROW_NUMBER() OVER (PARTITION BY lower(bp.word) ORDER BY bp.ord) AS pick
    FROM bank_pick bp
    WHERE NOT EXISTS (
      SELECT 1 FROM words w
      WHERE w.family_id = p_family_id AND lower(w.word) = lower(bp.word)
    )
  ) s
  WHERE s.pick = 1
),
merged AS (
  SELECT cb.id, cb.word, cb.phonetic, cb.uk_phonetic, cb.src, cb.cc, cb.wc
  FROM custom_base cb
  UNION ALL
  SELECT bd.id, bd.word, bd.phonetic, bd.uk_phonetic, bd.src, bd.cc, bd.wc
  FROM bank_dedup bd
)
SELECT
  (SELECT count(*)::bigint FROM merged),
  (SELECT count(*)::bigint FROM merged WHERE cc + wc > 0),
  (SELECT count(*)::bigint FROM merged WHERE cc + wc = 0),
  COALESCE(
    (SELECT jsonb_object_agg(x.src, x.c) FROM (
      SELECT m.src, count(*)::int AS c FROM merged m GROUP BY m.src
    ) x),
    '{}'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION get_parent_word_summary_page(
  p_family_id uuid,
  p_selected_banks text[],
  p_stage text DEFAULT 'all',
  p_bank_source text DEFAULT 'all',
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 30,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  is_bank_word boolean,
  word text,
  phonetic text,
  uk_phonetic text,
  source text,
  correct_count int,
  wrong_count int,
  prog_stage text,
  progress_id uuid,
  total_count bigint
)
LANGUAGE sql
STABLE
AS $$
WITH bank_ord AS (
  SELECT t.bank_id, t.ord::int AS ord
  FROM unnest(p_selected_banks) WITH ORDINALITY AS t(bank_id, ord)
  WHERE t.bank_id IS NOT NULL AND t.bank_id <> 'custom'
),
custom_base AS (
  SELECT
    w.id,
    w.word,
    w.phonetic,
    w.uk_phonetic,
    'custom'::text AS src,
    COALESCE(p.correct_count, 0)::int AS correct_count,
    COALESCE(p.wrong_count, 0)::int AS wrong_count,
    COALESCE(p.stage, 'testing')::text AS prog_stage,
    p.id AS progress_id,
    ROW_NUMBER() OVER (ORDER BY w.created_at DESC)::bigint AS gsk
  FROM words w
  LEFT JOIN progress p ON p.word_id = w.id AND p.family_id = p_family_id
  WHERE w.family_id = p_family_id
    AND 'custom' = ANY(p_selected_banks)
),
bank_pick AS (
  SELECT
    bw.id,
    bw.word,
    bw.us_phonetic AS phonetic,
    bw.uk_phonetic,
    bw.bank_id AS src,
    COALESCE(pr.correct_count, 0)::int AS correct_count,
    COALESCE(pr.wrong_count, 0)::int AS wrong_count,
    COALESCE(pr.stage, 'testing')::text AS prog_stage,
    pr.id AS progress_id,
    bo.ord
  FROM bank_words bw
  INNER JOIN bank_ord bo ON bw.bank_id = bo.bank_id
  LEFT JOIN progress pr ON pr.bank_word_id = bw.id AND pr.family_id = p_family_id
),
bank_dedup AS (
  SELECT
    s.id,
    s.word,
    s.phonetic,
    s.uk_phonetic,
    s.src,
    s.correct_count,
    s.wrong_count,
    s.prog_stage,
    s.progress_id,
    s.ord
  FROM (
    SELECT
      bp.*,
      ROW_NUMBER() OVER (PARTITION BY lower(bp.word) ORDER BY bp.ord) AS pick
    FROM bank_pick bp
    WHERE NOT EXISTS (
      SELECT 1 FROM words w
      WHERE w.family_id = p_family_id AND lower(w.word) = lower(bp.word)
    )
  ) s
  WHERE s.pick = 1
),
bank_ordered AS (
  SELECT
    bd.id,
    bd.word,
    bd.phonetic,
    bd.uk_phonetic,
    bd.src,
    bd.correct_count,
    bd.wrong_count,
    bd.prog_stage,
    bd.progress_id,
    (COALESCE((SELECT MAX(cb.gsk) FROM custom_base cb), 0)
      + ROW_NUMBER() OVER (ORDER BY bd.ord, bd.word))::bigint AS gsk
  FROM bank_dedup bd
),
merged AS (
  SELECT
    cb.id,
    false AS is_bank_word,
    cb.word,
    cb.phonetic,
    cb.uk_phonetic,
    cb.src,
    cb.correct_count,
    cb.wrong_count,
    cb.prog_stage,
    cb.progress_id,
    cb.gsk
  FROM custom_base cb
  UNION ALL
  SELECT
    bo.id,
    true,
    bo.word,
    bo.phonetic,
    bo.uk_phonetic,
    bo.src,
    bo.correct_count,
    bo.wrong_count,
    bo.prog_stage,
    bo.progress_id,
    bo.gsk
  FROM bank_ordered bo
),
filtered AS (
  SELECT m.*
  FROM merged m
  WHERE
    (p_stage IS NULL OR btrim(p_stage) = '' OR lower(p_stage) = 'all'
      OR (lower(p_stage) = 'tested' AND (m.correct_count + m.wrong_count) > 0)
      OR (lower(p_stage) = 'untested' AND (m.correct_count + m.wrong_count) = 0))
    AND (p_bank_source IS NULL OR btrim(p_bank_source) = '' OR lower(p_bank_source) = 'all'
      OR m.src = p_bank_source)
    AND (p_search IS NULL OR btrim(p_search) = ''
      OR strpos(lower(m.word), lower(btrim(p_search))) > 0)
),
total_cte AS (
  SELECT count(*)::bigint AS tc FROM filtered
),
paged AS (
  SELECT f.*, t.tc AS total_count
  FROM filtered f
  CROSS JOIN total_cte t
  ORDER BY f.gsk
  LIMIT greatest(COALESCE(p_limit, 30), 1)
  OFFSET greatest(COALESCE(p_offset, 0), 0)
)
SELECT
  p.id,
  p.is_bank_word,
  p.word,
  p.phonetic,
  p.uk_phonetic,
  p.src,
  p.correct_count,
  p.wrong_count,
  p.prog_stage,
  p.progress_id,
  p.total_count
FROM paged p;
$$;

GRANT EXECUTE ON FUNCTION get_parent_word_list_stats(uuid, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_parent_word_summary_page(uuid, text[], text, text, text, int, int) TO anon, authenticated;
