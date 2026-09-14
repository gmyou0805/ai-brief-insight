// Google Gemini 무료 티어로 기사 2문장 요약 생성.
// GEMINI_API_KEY 가 없거나 호출이 실패하면 null 을 반환 — 이 경우 웹에서 기존 추출식 요약으로 자동 대체됨.
//
// 키 발급(무료, 카드 등록 불필요): https://aistudio.google.com/apikey
// .env 에 GEMINI_API_KEY=... 추가하면 활성화됨(없으면 이 기능 자체를 건너뜀).

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function summarizeArticle(title, abstract) {
  if (!GEMINI_API_KEY || !abstract) return null;

  const prompt = `다음은 뉴스 기사의 제목과 설명이다. 핵심 내용을 정확히 2개의 완성된 한국어 문장으로 요약해라.
각 문장은 마침표로 끝나야 하고, 불필요한 수식어나 광고성 표현 없이 사실 위주로 써라.
요약 문장 두 개 외에 다른 말은 절대 하지 마라(설명, 인사말, 목록 기호 등 금지).

제목: ${title}
설명: ${abstract}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 220 },
        }),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[요약] Gemini 오류 ${res.status} — ${title} (${body.slice(0, 150)})`);
      return null;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : null;
  } catch (err) {
    console.warn(`[요약] Gemini 호출 실패 — ${title} (${err.message})`);
    return null;
  }
}

// 기사 배열에 summary_ko 필드를 채워서 반환. 요청 사이 간격을 둬 무료 티어 분당 한도를 지킨다.
async function summarizeAll(articles) {
  if (!GEMINI_API_KEY) {
    console.log('[요약] GEMINI_API_KEY 없음 — AI 요약 생략(사이트는 추출식 요약으로 표시됨)');
    return articles.map((a) => ({ ...a, summary_ko: null }));
  }

  console.log(`[요약] Gemini(${GEMINI_MODEL})로 ${articles.length}건 요약 중…`);
  const out = [];
  for (const a of articles) {
    const summary = await summarizeArticle(a.title, a.abstract);
    out.push({ ...a, summary_ko: summary });
    await sleep(1200);
  }
  const okCount = out.filter((a) => a.summary_ko).length;
  console.log(`[요약] 완료 — ${okCount}/${articles.length}건 성공`);
  return out;
}

module.exports = { summarizeAll, summarizeArticle };
