import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY 环境变量");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const BANK_DIR = join(import.meta.dirname, "../public/data/word-banks");
const BATCH_SIZE = 200;

async function importBank(filePath) {
  const raw = readFileSync(filePath, "utf-8");
  const bank = JSON.parse(raw);
  const bankId = bank.id;

  console.log(`\n导入 ${bankId} (${bank.wordCount} 词)...`);

  const rows = bank.words.map((w) => ({
    bank_id: bankId,
    word: w.word,
    us_phonetic: w.usPhonetic || "",
    uk_phonetic: w.ukPhonetic || "",
    meanings: w.meanings || [],
  }));

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("bank_words")
      .upsert(batch, { onConflict: "bank_id,word" });
    if (error) {
      console.error(`  批次 ${i}-${i + batch.length} 失败:`, error.message);
    } else {
      inserted += batch.length;
      process.stdout.write(`\r  已导入 ${inserted} / ${rows.length}`);
    }
  }
  console.log(`\n  ✅ ${bankId} 完成: ${inserted} 词`);
}

async function main() {
  const files = readdirSync(BANK_DIR).filter((f) => f.endsWith(".json"));
  console.log(`发现 ${files.length} 个词库文件`);

  for (const file of files) {
    await importBank(join(BANK_DIR, file));
  }

  const { count } = await supabase
    .from("bank_words")
    .select("*", { count: "exact", head: true });
  console.log(`\n全部完成！bank_words 表共 ${count} 条记录`);
}

main().catch(console.error);
