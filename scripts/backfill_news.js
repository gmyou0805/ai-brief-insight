// 뉴스 소급 수집(1회성) — 현재 RSS 피드에 남아있는 과거 기사 중 BACKFILL_FROM 이후 것만 채워넣는다.
// 주의: RSS 피드는 보통 최신 ~50건만 유지하므로, 요청한 시작일이 피드 보관 범위보다 오래됐으면
// 그만큼은 애초에 가져올 수 없다(사이트 자체 아카이브를 크롤링하지 않는 한 불가능).
//
// 실행: node scripts/backfill_news.js
try {
  require('dotenv').config();
} catch (_) {
  /* ignore */
}

const { getPool, closePool } = require('./db');

const BACKFILL_FROM = '2026-09-01';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

// AI_RULES/SECURITY_RULES/CORE_RELEVANCE_KEYWORDS — scripts/fetch_and_summarize.js 와 동일하게 유지
const AI_RULES = [
  ['양자기술', ['양자', '퀀텀', 'quantum', '큐비트', 'qubit']],
  ['드론', ['드론', 'drone', 'uav']],
  ['반도체·인프라', ['반도체', '엔비디아', 'gpu', 'hbm', '칩', '데이터센터', 'tpu', 'npu', '파운드리', 'tsmc', '인프라']],
  ['로봇·자율주행', ['로봇', '휴머노이드', '자율주행', '자동차', '테슬라', '피지컬']],
  ['정책·규제', ['규제', '정책', '정부', '법안', '법률', '저작권', '소송', '개인정보', '규정', '당국', '국회']],
  ['기업·투자', ['투자', '인수', '상장', '펀딩', '자금조달', '매출', '실적', '지분', '유치', 'ipo', '기업가치']],
  ['생성형AI·LLM', ['llm', 'gpt', '챗gpt', '생성형', '언어모델', '오픈ai', '제미나이', '클로드', '라마', '미스트랄', '챗봇', '모델', '앤트로픽', '딥시크', '키미']],
  ['서비스·응용', ['출시', '앱', '플랫폼', '솔루션', '에이전트', '비서']],
  ['연구·기술', ['연구', '논문', '기술', '개발', '성능', '학습', '알고리즘', '벤치마크', '오픈소스']],
];

const SECURITY_RULES = [
  ['양자기술', ['양자', '퀀텀', 'quantum', '큐비트', 'qubit']],
  ['취약점·제로데이', ['취약점', '제로데이', 'cve', '패치', '익스플로잇', '버그', '결함', '보안 업데이트', '보안업데이트']],
  ['침해사고·정보유출', ['유출', '해킹', '침해', '공격', '탈취', '유출사고', '데이터 유출', '디도스', 'ddos', '해커']],
  ['랜섬웨어·악성코드', ['랜섬웨어', '악성코드', '멀웨어', 'apt', '피싱', '백도어', '트로이목마', '스미싱', '악성']],
  ['제로트러스트', ['제로트러스트', 'zero trust', 'zta', 'sase']],
  ['개인정보·보안규제', ['개인정보', '컴플라이언스', 'gdpr', '개인정보보호법', '보안 인증', '보안 규제', '보안규제']],
];

const COMBINED_RULES = [...AI_RULES, ...SECURITY_RULES];

const CORE_RELEVANCE_KEYWORDS = [
  'ai', '인공지능', '보안', '해킹', '공격', '침해', '유출', '취약점', '랜섬웨어', '악성코드',
  '피싱', '개인정보', '제로트러스트', '양자', '드론', '로봇', '반도체', 'llm', 'gpt', '생성형',
  '챗봇', '머신러닝', '딥러닝', '알고리즘',
];

function hasCoreRelevance(title, abstract) {
  const text = `${title} ${abstract || ''}`.toLowerCase();
  return CORE_RELEVANCE_KEYWORDS.some((k) => text.includes(k));
}

function matchCategory(title, abstract, rules) {
  const text = `${title} ${abstract || ''}`.toLowerCase();
  for (const [cat, kws] of rules) {
    if (kws.some((k) => text.includes(k.toLowerCase()))) return cat;
  }
  return null;
}

const NOISE = ['[게시판]', '[인사]', '[부고]', '[신간]', '[포토]', '[카드뉴스]'];

const SOURCES = [
  { name: 'AI타임즈', rss: 'https://www.aitimes.com/rss/allArticle.xml', rules: AI_RULES },
  { name: '데일리시큐', rss: 'https://www.dailysecu.com/rss/allArticle.xml', rules: SECURITY_RULES },
  { name: '데이터넷', rss: 'https://www.datanet.co.kr/rss/allArticle.xml', rules: COMBINED_RULES },
  { name: '전자신문', rss: 'http://rss.etnews.com/04.xml', rules: COMBINED_RULES },
  { name: '지티티코리아', rss: 'https://www.gttkorea.com/rss/S2N1.xml', rules: COMBINED_RULES },
];

function decodeEntities(s) {
  if (!s) return '';
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeEntities(m[1]) : '';
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} (${url})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const head = buf.slice(0, 1024).toString('latin1').toLowerCase();
  const m = head.match(/(?:encoding|charset)=["']?([\w-]+)/);
  let enc = 'utf-8';
  if (m && /euc-?kr|ksc5601|ks_c_5601/.test(m[1])) enc = 'euc-kr';
  try {
    return new TextDecoder(enc).decode(buf);
  } catch (_) {
    return buf.toString('utf-8');
  }
}

function stripLeadingBracket(title) {
  const stripped = title.replace(/^\[[^\]]*\]\s*/, '').trim();
  return stripped || title;
}

async function fetchRss(url) {
  const xml = await fetchText(url);
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const link = tag(block, 'link');
    if (!link) continue;
    items.push({
      title: tag(block, 'title') || '(제목 없음)',
      url: link,
      abstract: tag(block, 'description'),
      pub_date: tag(block, 'pubDate'),
    });
  }
  return items
    .filter((it) => !NOISE.some((n) => it.title.startsWith(n)))
    .map((it) => ({ ...it, title: stripLeadingBracket(it.title) }));
}

function extractMeta(html, prop) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'),
  ];
  for (const re of patterns) {
    const mm = html.match(re);
    if (mm) return mm[1];
  }
  return null;
}

async function enrichWithImage(url) {
  try {
    const html = await fetchText(url);
    return extractMeta(html, 'og:image');
  } catch (_) {
    return null;
  }
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

async function backfillSource(src, pool) {
  console.log(`[소급수집] ${src.name} RSS…`);
  const items = await fetchRss(src.rss);

  const dated = items
    .map((it) => ({ ...it, pubDateObj: it.pub_date ? new Date(it.pub_date) : null }))
    .filter((it) => it.pubDateObj && !isNaN(it.pubDateObj.getTime()));

  const oldestInFeed = dated.length
    ? ymd(dated.reduce((a, b) => (a.pubDateObj < b.pubDateObj ? a : b)).pubDateObj)
    : null;

  const inRange = dated.filter((it) => ymd(it.pubDateObj) >= BACKFILL_FROM);

  const picked = [];
  for (const it of inRange) {
    const rawMatch = matchCategory(it.title, it.abstract, src.rules);
    if (!rawMatch || !hasCoreRelevance(it.title, it.abstract)) continue;
    picked.push({ ...it, category: rawMatch });
  }

  console.log(
    `[소급수집] ${src.name} — 피드 보관범위 최고(最古) ${oldestInFeed ?? '알수없음'} · ` +
      `${BACKFILL_FROM} 이후 관련기사 ${picked.length}건 (전체 ${items.length}건 중)`
  );

  // 같은 날짜(collected_for) 안에서의 순번 — 홈 화면 partition 정렬용
  const rankByDay = new Map();
  const rows = [];
  for (const it of picked) {
    const collectedFor = ymd(it.pubDateObj);
    const rank = (rankByDay.get(collectedFor) ?? 0) + 1;
    rankByDay.set(collectedFor, rank);
    const image_url = await enrichWithImage(it.url);
    rows.push({
      nyt_url: it.url,
      rank,
      title: it.title,
      abstract: it.abstract,
      summary_ko: null, // Gemini 요약 생략(웹에서 추출식 요약으로 자동 대체)
      category: it.category,
      image_url,
      byline: null,
      section: src.name,
      source_links: JSON.stringify([{ label: `${src.name} 원문`, url: it.url }]),
      published_at: it.pubDateObj.toISOString(),
      collected_for: collectedFor,
      content_type: 'news',
    });
  }

  if (rows.length === 0) return 0;

  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query('begin');
    for (const r of rows) {
      const result = await client.query(
        `insert into articles
           (nyt_url, rank, title, abstract, summary_ko, category, image_url,
            byline, section, source_links, published_at, collected_for, content_type)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13)
         on conflict (nyt_url) do nothing`,
        [
          r.nyt_url, r.rank, r.title, r.abstract, r.summary_ko, r.category, r.image_url,
          r.byline, r.section, r.source_links, r.published_at, r.collected_for, r.content_type,
        ]
      );
      inserted += result.rowCount;
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
  return inserted;
}

(async () => {
  const pool = getPool();
  let total = 0;
  try {
    for (const src of SOURCES) {
      try {
        total += await backfillSource(src, pool);
      } catch (err) {
        console.warn(`⚠️  ${src.name} 소급수집 실패: ${err.message}`);
      }
    }
    console.log(`✅ 소급수집 완료 — 새로 저장된 기사 ${total}건`);
  } finally {
    await closePool();
  }
})();
