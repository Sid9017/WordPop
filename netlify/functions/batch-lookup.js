import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BANK_DIR = join(__dirname, "../../public/data/word-banks");

let wordLookup = null;

function buildLookup() {
  if (wordLookup) return wordLookup;
  wordLookup = {};
  try {
    const files = readdirSync(BANK_DIR).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const bank = JSON.parse(readFileSync(join(BANK_DIR, file), "utf-8"));
      for (const w of bank.words || []) {
        const key = w.word.toLowerCase();
        if (!wordLookup[key]) wordLookup[key] = w;
      }
    }
  } catch {
    wordLookup = {};
  }
  return wordLookup;
}

const POS_MAP = {
  n: "noun", v: "verb", adj: "adjective", adv: "adverb",
  prep: "preposition", conj: "conjunction", pron: "pronoun",
  int: "interjection", vt: "verb", vi: "verb", aux: "verb",
};

function fmtPhonetic(raw) {
  if (!raw) return "";
  raw = raw.trim();
  if (!raw.startsWith("/")) raw = "/" + raw;
  if (!raw.endsWith("/")) raw = raw + "/";
  return raw;
}

async function lookupYoudao(word) {
  const dictsParam = encodeURIComponent(
    JSON.stringify({ count: 99, dicts: [["ec", "blng_sents_part"]] })
  );
  const url = `https://dict.youdao.com/jsonapi_s?doctype=json&jsonversion=4&le=en&q=${encodeURIComponent(word)}&dicts=${dictsParam}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const ecWord = data.ec?.word;
    const ec = Array.isArray(ecWord) ? ecWord[0] : ecWord;
    if (!ec) return null;

    const sentPairs = data.blng_sents_part?.["sentence-pair"] || [];
    const meanings = (ec.trs || []).map((t, idx) => {
      const sent = sentPairs[idx];
      return {
        pos: POS_MAP[t.pos?.replace(".", "")] || t.pos?.replace(".", "") || "",
        meaning_cn: t.tran || "",
        meaning_en: "",
        example: (sent?.sentence || "").replace(/<[^>]*>/g, ""),
        example_cn: sent?.["sentence-translation"] || "",
      };
    });
    if (!meanings.length) return null;
    return {
      word: ec["return-phrase"]?.l?.i || word,
      ukPhonetic: fmtPhonetic(ec.ukphone),
      usPhonetic: fmtPhonetic(ec.usphone),
      meanings,
    };
  } catch {
    return null;
  }
}

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const words = body.words;
  if (!Array.isArray(words) || !words.length) {
    return new Response(JSON.stringify({ error: "words array required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const lookup = buildLookup();
  const found = [];
  const toQuery = [];

  for (const raw of words) {
    const w = raw.trim().toLowerCase();
    if (!w) continue;
    if (lookup[w]) {
      found.push(lookup[w]);
    } else {
      toQuery.push(w);
    }
  }

  const BATCH = 5;
  for (let i = 0; i < toQuery.length; i += BATCH) {
    const batch = toQuery.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(lookupYoudao));
    for (const r of results) {
      if (r) found.push(r);
    }
  }

  return new Response(
    JSON.stringify({ results: found, total: words.length, found: found.length }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

export const config = { path: "/api/batch-lookup" };
