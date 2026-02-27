-- WordPop 数据库 Schema
-- 在 Supabase SQL Editor 中执行

-- 单词表
create table words (
  id uuid default gen_random_uuid() primary key,
  word text not null unique,
  phonetic text,
  image_url text,
  created_at timestamptz default now()
);

-- 义项表（一个单词可有多个义项）
create table meanings (
  id uuid default gen_random_uuid() primary key,
  word_id uuid references words(id) on delete cascade,
  pos text,
  meaning_en text,
  meaning_cn text,
  example text
);

-- 学习进度表
create table progress (
  id uuid default gen_random_uuid() primary key,
  word_id uuid references words(id) on delete cascade unique,
  stage text default 'new' check (stage in ('new','learning','mastered')),
  correct_count int default 0,
  wrong_count int default 0,
  last_quiz_at timestamptz,
  next_review_at timestamptz default now()
);

-- 测试记录表
create table quiz_log (
  id uuid default gen_random_uuid() primary key,
  word_id uuid references words(id) on delete cascade,
  meaning_id uuid references meanings(id) on delete cascade,
  quiz_type text check (quiz_type in ('cn2en','en2cn','spell')),
  is_correct boolean,
  created_at timestamptz default now()
);

-- 打卡表
create table checkins (
  id uuid default gen_random_uuid() primary key,
  check_date date not null unique default current_date,
  created_at timestamptz default now()
);

-- 索引
create index idx_progress_stage on progress(stage);
create index idx_progress_next_review on progress(next_review_at);
create index idx_quiz_log_created on quiz_log(created_at);
create index idx_meanings_word on meanings(word_id);

-- RLS 关闭（个人使用，简化处理）
alter table words enable row level security;
alter table meanings enable row level security;
alter table progress enable row level security;
alter table quiz_log enable row level security;
alter table checkins enable row level security;

create policy "Allow all on words" on words for all using (true) with check (true);
create policy "Allow all on meanings" on meanings for all using (true) with check (true);
create policy "Allow all on progress" on progress for all using (true) with check (true);
create policy "Allow all on quiz_log" on quiz_log for all using (true) with check (true);
create policy "Allow all on checkins" on checkins for all using (true) with check (true);
