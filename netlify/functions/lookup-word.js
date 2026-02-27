// Netlify Function: 查询单词释义 + 自动翻译成中文
export default async (req) => {
  const url = new URL(req.url);
  const word = url.searchParams.get("word")?.trim().toLowerCase();

  if (!word) {
    return new Response(JSON.stringify({ error: "缺少 word 参数" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const dictRes = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );

    if (!dictRes.ok) {
      return new Response(
        JSON.stringify({ error: "词典未找到该单词", word }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const dictData = await dictRes.json();
    const entry = dictData[0];
    const phonetic =
      entry.phonetic ||
      entry.phonetics?.find((p) => p.text)?.text ||
      "";

    const meanings = [];
    for (const m of entry.meanings || []) {
      for (const def of m.definitions || []) {
        const enText = def.definition;
        const cnText = await translateToChinese(enText);
        meanings.push({
          pos: m.partOfSpeech || "",
          meaning_en: enText,
          meaning_cn: cnText,
          example: def.example || "",
        });
      }
    }

    let imageUrl = "";
    try {
      const pixabayKey = process.env.PIXABAY_API_KEY || "";
      const imgRes = await fetch(
        `https://pixabay.com/api/?key=${pixabayKey}&q=${encodeURIComponent(word)}&image_type=illustration&per_page=3&safesearch=true`
      );
      if (imgRes.ok) {
        const imgData = await imgRes.json();
        imageUrl = imgData.hits?.[0]?.webformatURL || "";
      }
    } catch {
      // 图片获取失败不影响主流程
    }

    return new Response(
      JSON.stringify({ word, phonetic, imageUrl, meanings }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "服务器错误", detail: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

async function translateToChinese(text) {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`
    );
    if (res.ok) {
      const data = await res.json();
      return data.responseData?.translatedText || text;
    }
  } catch {
    // fallback
  }
  return text;
}

export const config = {
  path: "/api/lookup-word",
};
