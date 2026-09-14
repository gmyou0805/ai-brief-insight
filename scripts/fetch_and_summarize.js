// 멀티소스 뉴스 수집(AI타임즈 + 보안뉴스) → 키워드 분류/관련도 필터 → Postgres 저장
//
// 로컬 실행:  npm run collect   (또는 node scripts/fetch_and_summarize.js)
// 운영: docker-compose 의 collector 컨테이너가 매일 09:00 KST 에 crond 로 자동 실행(docker/crontab)
//
// 출처:
//   - AI타임즈    : https://www.aitimes.com/rss/allArticle.xml       (전체 → 잡음 제외 상위 10건)
//   - 데일리시큐  : https://www.dailysecu.com/rss/allArticle.xml     (전체기사 → 관심 키워드 매칭분만)
//     (2026-08: 보안뉴스 RSS 완전 중단(404, 홈페이지에서도 RSS 링크 삭제) 확인 → 데일리시큐로 교체)
//   - 데이터넷    : https://www.datanet.co.kr/rss/allArticle.xml     (전체기사 → AI·보안 키워드 매칭분만)
//   - 전자신문    : http://rss.etnews.com/04.xml                     (AI·SW 섹션 → AI·보안 키워드 매칭분만)
//   - 지티티코리아: https://www.gttkorea.com/rss/S2N1.xml             (IT·산업 섹션 → AI·보안 키워드 매칭분만)
// * RSS·분류는 API 키 불필요(무료). 요약은 Gemini 무료 티어 사용(GEMINI_API_KEY 없으면 자동 생략). 저장은 Postgres.

try {
  require('dotenv').config();
} catch (_) {
  /* dotenv 미설치(운영 환경) → 무시 */
}

const { generateReport, buildCsv, writeReportFile } = require('./generate_report');
const { summarizeAll } = require('./gemini');
const { collectPapers } = require('./collectors/papers');
const { collectYoutube } = require('./collectors/youtube');
const { collectBlogs } = require('./collectors/blogs');
const { collectPatents } = require('./collectors/patents');

// ── 설정 ──
const { DATABASE_URL } = process.env;
const NO_DB = process.argv.includes('--no-db'); // DB 저장/조회 없이 로컬 리포트만 생성

const TOP_N = 5; // 소스별 최대 수집 건수
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const NOISE = ['[게시판]', '[인사]', '[부고]', '[신간]', '[포토]', '[카드뉴스]'];

// AI타임즈 카테고리 규칙 (웹 lib/categories.ts 의 AI_CATEGORIES 와 동일하게 유지)
const AI_RULES = [
  // '반도체·인프라'/'로봇·자율주행'보다 먼저 검사 — 안 그러면 "양자컴퓨터 칩", "드론 로봇" 같은
  // 제목이 반도체나 로봇으로 잘못 분류됨
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

// 보안뉴스 관심 주제 규칙 (웹 lib/categories.ts 의 SECURITY_CATEGORIES 와 동일하게 유지)
// * 매칭되는 기사만 "유의미"로 보고 저장한다(관련도 필터).
const SECURITY_RULES = [
  // 다른 규칙보다 먼저 검사 — "양자내성암호" 등이 취약점/개인정보 규칙에 잘못 걸리지 않도록
  ['양자기술', ['양자', '퀀텀', 'quantum', '큐비트', 'qubit']],
  ['취약점·제로데이', ['취약점', '제로데이', 'cve', '패치', '익스플로잇', '버그', '결함', '보안 업데이트', '보안업데이트']],
  ['침해사고·정보유출', ['유출', '해킹', '침해', '공격', '탈취', '유출사고', '데이터 유출', '디도스', 'ddos', '해커']],
  ['랜섬웨어·악성코드', ['랜섬웨어', '악성코드', '멀웨어', 'apt', '피싱', '백도어', '트로이목마', '스미싱', '악성']],
  // '개인정보·보안규제'보다 먼저 검사 — 안 그러면 "인증" 같은 단어 때문에 그쪽으로 잘못 분류됨
  ['제로트러스트', ['제로트러스트', 'zero trust', 'zta', 'sase']],
  ['개인정보·보안규제', ['개인정보', '컴플라이언스', 'gdpr', '개인정보보호법', '보안 인증', '보안 규제', '보안규제']],
];

// 보안·AI 관련 핵심 키워드 — 이 중 하나도 없으면 위 세부 카테고리에 매칭돼도 무관한 기사로 보고 제외한다.
// (예: "쌀의 활용도를 높이고" 처럼 일반 단어가 우연히 세부 키워드와 겹쳐 엉뚱하게 분류되는 것 방지)
const CORE_RELEVANCE_KEYWORDS = [
  'ai',
  '인공지능',
  '보안',
  '해킹',
  '공격',
  '침해',
  '유출',
  '취약점',
  '랜섬웨어',
  '악성코드',
  '피싱',
  '개인정보',
  '제로트러스트',
  '양자',
  '드론',
  '로봇',
  '반도체',
  'llm',
  'gpt',
  '생성형',
  '챗봇',
  '머신러닝',
  '딥러닝',
  '알고리즘',
];

function hasCoreRelevance(title, abstract) {
  const text = `${title} ${abstract || ''}`.toLowerCase();
  return CORE_RELEVANCE_KEYWORDS.some((k) => text.includes(k));
}

// AI+보안 규칙 통합(범위가 넓은 일반 매체용 관련도 필터에 사용)
const COMBINED_RULES = [...AI_RULES, ...SECURITY_RULES];

// 좌측 사이드바 "분야" 매핑 (웹 lib/categories.ts 의 FIELDS/FIELD_CATEGORIES/FIELD_KEYWORDS 와 동일하게 유지)
// — 소스별 상위 N건을 뽑을 때 한 분야로 쏠리지 않도록 분야별 라운드로빈에 사용.
// '로봇' 분야는 없앰 — 로봇·자율주행 카테고리는 AI 분야로 편입.
const FIELDS_ORDER = ['AI', '양자', '드론', '정책동향', '침해사고', '제로트러스트', '기타'];
const FIELD_CATEGORIES = {
  AI: ['생성형AI·LLM', '반도체·인프라', '기업·투자', '서비스·응용', '연구·기술', '로봇·자율주행'],
  정책동향: ['정책·규제', '개인정보·보안규제'],
  침해사고: ['취약점·제로데이', '침해사고·정보유출', '랜섬웨어·악성코드'],
  제로트러스트: ['제로트러스트'],
  양자: ['양자기술'],
  드론: ['드론'],
  기타: ['기타'],
};
const FIELD_KEYWORDS = { 양자: '양자', 드론: '드론', 제로트러스트: '제로트러스트' };

function fieldOf(title, category) {
  for (const f of FIELDS_ORDER) {
    const kw = FIELD_KEYWORDS[f];
    if (kw && title.includes(kw)) return f;
  }
  for (const f of FIELDS_ORDER) {
    if (FIELD_CATEGORIES[f] && FIELD_CATEGORIES[f].includes(category)) return f;
  }
  return '기타';
}

// 최근 며칠 내 이미 수집한 기사와 같은 제목이면 중복으로 보고 걸러내기 위한 정규화
// (공백·문장부호·대소문자 차이는 무시하고 비교)
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .trim();
}

// 소스 정의
const SOURCES = [
  {
    name: 'AI타임즈',
    rss: 'https://www.aitimes.com/rss/allArticle.xml',
    rules: AI_RULES,
    relevanceOnly: true, // AI타임즈도 지역행사 등 무관 기사를 종종 섞어 보내서 키워드 매칭분만 저장
  },
  {
    name: '데일리시큐',
    rss: 'https://www.dailysecu.com/rss/allArticle.xml',
    rules: SECURITY_RULES,
    relevanceOnly: true, // 키워드 매칭되는 기사만 저장
  },
  {
    name: '데이터넷',
    // 보안(S2N3) 전용 RSS가 없어 전체기사 피드에서 AI·보안 키워드로 골라냄
    rss: 'https://www.datanet.co.kr/rss/allArticle.xml',
    rules: COMBINED_RULES,
    relevanceOnly: true,
  },
  {
    name: '전자신문',
    // AI·SW 섹션(id1=04, AI/SW/보안 하위 통합) 피드
    rss: 'http://rss.etnews.com/04.xml',
    rules: COMBINED_RULES,
    relevanceOnly: true,
  },
  {
    name: '지티티코리아',
    // 요청하신 IT·산업(S2N1) 섹션 피드
    rss: 'https://www.gttkorea.com/rss/S2N1.xml',
    rules: COMBINED_RULES,
    relevanceOnly: true,
  },
];

// 사용자가 채널관리에서 추가한 뉴스 RSS(follows 테이블, source_type='news')를 조회.
// 큐레이션 SOURCES 와 같은 형태로 맞춰서 동일한 collectSource() 로직을 그대로 재사용한다.
async function loadFollowedNewsSources(pool) {
  if (!pool) return [];
  try {
    const { rows } = await pool.query(
      `select distinct target_url as rss, label as name
       from follows
       where source_type = 'news'`
    );
    return rows
      .filter((r) => r.rss)
      .map((r) => ({
        name: r.name || r.rss,
        rss: r.rss,
        rules: COMBINED_RULES,
        relevanceOnly: true, // 사용자가 등록한 소스는 어떤 매체인지 알 수 없으니 관련도 필터를 항상 적용
      }));
  } catch (err) {
    console.warn(`⚠️  팔로우 뉴스 소스 조회 실패: ${err.message}`);
    return [];
  }
}

function requireEnv(name, value) {
  if (!value) {
    console.error(`[설정오류] 환경변수 ${name} 가 없습니다. .env 또는 Secrets 를 확인하세요.`);
    process.exit(1);
  }
}
requireEnv('DATABASE_URL', DATABASE_URL);

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

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

// 인코딩 자동 감지 디코딩 (AI타임즈=UTF-8, 보안뉴스=EUC-KR)
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

// 키워드 규칙으로 카테고리 판별. 매칭 없으면 null 반환.
function matchCategory(title, abstract, rules) {
  const text = `${title} ${abstract || ''}`.toLowerCase();
  for (const [cat, kws] of rules) {
    if (kws.some((k) => text.includes(k.toLowerCase()))) return cat;
  }
  return null;
}

// 제목 맨 앞의 "[8월19일]", "[인터뷰]" 같은 대괄호 태그 제거(NOISE 판별 이후에만 적용)
function stripLeadingBracket(title) {
  const stripped = title.replace(/^\[[^\]]*\]\s*/, '').trim();
  return stripped || title;
}

// ── RSS 파싱 ──
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

// ── 대표이미지(og:image) 수집 (best-effort) ──
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enrichWithImage(url) {
  try {
    const html = await fetchText(url);
    return extractMeta(html, 'og:image');
  } catch (_) {
    return null;
  }
}

// ── 한 소스 수집 ──
async function collectSource(src, recentTitles) {
  console.log(`[수집] ${src.name} RSS…`);
  const items = await fetchRss(src.rss);

  // 관련도 필터(보안뉴스): 키워드 매칭되는 기사만. AI타임즈: 전체(카테고리는 매칭 or 기타).
  // + 최근 며칠 내 같은 제목이 이미 수집됐으면 후보에서 제외(재게재 중복 방지).
  const candidates = [];
  let dupSkipped = 0;
  for (const it of items) {
    const rawMatch = matchCategory(it.title, it.abstract, src.rules);
    // 카테고리 키워드가 우연히 걸려도 AI/보안 핵심 키워드가 전혀 없으면 무관 기사로 본다
    // (예: "쌀의 활용도를 높이고" → '활용' 단어만으로 서비스·응용에 잘못 매칭되는 것 방지)
    const matched = rawMatch && hasCoreRelevance(it.title, it.abstract) ? rawMatch : null;
    if (src.relevanceOnly && !matched) continue; // 무관 기사 제외
    if (recentTitles.has(normalizeTitle(it.title))) {
      dupSkipped++;
      continue;
    }
    const category = matched || '기타';
    candidates.push({ ...it, category, field: fieldOf(it.title, category) });
  }

  // 분야별로 고르게 뽑기(라운드로빈) — AI 등 특정 분야로만 쏠리지 않도록.
  const byField = new Map(FIELDS_ORDER.map((f) => [f, []]));
  for (const c of candidates) byField.get(c.field).push(c);

  const picked = [];
  let progressed = true;
  while (picked.length < TOP_N && progressed) {
    progressed = false;
    for (const bucket of byField.values()) {
      if (picked.length >= TOP_N) break;
      if (bucket.length > 0) {
        picked.push(bucket.shift());
        progressed = true;
      }
    }
  }

  if (dupSkipped > 0) {
    console.log(`[수집] ${src.name} — 중복(재게재) ${dupSkipped}건 제외`);
  }
  console.log(
    `[수집] ${src.name} — ${items.length}건 중 ${picked.length}건 선정(분야 분산), 이미지 수집 중…`
  );

  const out = [];
  for (let i = 0; i < picked.length; i++) {
    const it = picked[i];
    const image_url = await enrichWithImage(it.url);
    out.push({
      ...it,
      rank: i + 1,
      section: src.name, // section = 출처
      image_url,
      source_links: [{ label: `${src.name} 원문`, url: it.url }],
    });
    console.log(
      `   - [${src.name} ${i + 1}] ${it.category}(${it.field})${image_url ? ' · 이미지O' : ' · 이미지X'}`
    );
    // 원본 사이트에 짧은 시간 요청이 몰리지 않도록(자동 차단 방지) 다음 요청 전 대기
    if (i < picked.length - 1) await sleep(800);
  }
  return out;
}

// ── Postgres 저장 (같은 날짜분 교체) ──
async function save(articles) {
  const { getPool } = require('./db');
  const pool = getPool();
  const collectedFor = ymd(new Date());

  const rows = articles.map((a) => ({
    nyt_url: a.url, // 컬럼명 유지(고유키) — 값은 기사 URL
    rank: a.rank,
    title: a.title,
    abstract: a.abstract,
    summary_ko: a.summary_ko ?? null, // Gemini 요약(없으면 null → 웹에서 추출식으로 대체)
    category: a.category,
    image_url: a.image_url,
    byline: null,
    section: a.section, // 출처(AI타임즈 / 보안뉴스)
    source_links: JSON.stringify(a.source_links ?? []),
    published_at: a.pub_date ? new Date(a.pub_date).toISOString() : null,
    collected_for: collectedFor,
    content_type: a.content_type || 'news',
  }));

  console.log(`[저장] Postgres … ${rows.length}건`);
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('delete from articles where collected_for = $1', [collectedFor]);

    for (const r of rows) {
      await client.query(
        `insert into articles
           (nyt_url, rank, title, abstract, summary_ko, category, image_url,
            byline, section, source_links, published_at, collected_for, content_type)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13)
         on conflict (nyt_url) do update set
           rank = excluded.rank,
           title = excluded.title,
           abstract = excluded.abstract,
           summary_ko = excluded.summary_ko,
           category = excluded.category,
           image_url = excluded.image_url,
           byline = excluded.byline,
           section = excluded.section,
           source_links = excluded.source_links,
           published_at = excluded.published_at,
           collected_for = excluded.collected_for,
           content_type = excluded.content_type`,
        [
          r.nyt_url,
          r.rank,
          r.title,
          r.abstract,
          r.summary_ko,
          r.category,
          r.image_url,
          r.byline,
          r.section,
          r.source_links,
          r.published_at,
          r.collected_for,
          r.content_type,
        ]
      );
    }

    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw new Error(`Postgres 저장 오류: ${err.message}`);
  } finally {
    client.release();
  }
  console.log(`[저장] 완료 — ${collectedFor} 기준 ${rows.length}건 저장됨`);
}

// ── 메인 ──
(async () => {
  try {
    // 최근 7일간 이미 수집된 제목 목록(중복 재게재 판별용). NO_DB 모드는 DB가 없으니 건너뜀.
    let recentTitles = new Set();
    if (!NO_DB) {
      const { getPool } = require('./db');
      const pool = getPool();
      const { rows: recentRows } = await pool.query(
        `select title from articles
         where collected_for >= current_date - interval '7 days'
           and collected_for < current_date`
      );
      recentTitles = new Set(recentRows.map((r) => normalizeTitle(r.title)));
      console.log(`[중복검사] 최근 7일 제목 ${recentTitles.size}건 로드`);
    }

    // 뉴스 외 콘텐츠 유형(논문/유튜브/블로그/특허)과 사용자 팔로우 뉴스 소스는 DB pool 이 필요(NO_DB 모드는 건너뜀).
    const extraPool = NO_DB ? null : require('./db').getPool();
    const followedNews = await loadFollowedNewsSources(extraPool);

    const all = [];
    for (const src of [...SOURCES, ...followedNews]) {
      try {
        const rows = await collectSource(src, recentTitles);
        all.push(...rows);
      } catch (err) {
        // 소스 하나가 죽어도(예: RSS 주소 변경) 나머지 소스는 계속 수집한다.
        console.warn(`⚠️  ${src.name} 수집 실패, 건너뜀: ${err.message}`);
      }
    }

    // 나머지 콘텐츠 유형(논문/유튜브/블로그/특허) — 소스 하나가 실패해도 나머지는 계속 수집.
    try {
      all.push(...(await collectPapers(recentTitles)));
    } catch (err) {
      console.warn(`⚠️  논문 수집 실패, 건너뜀: ${err.message}`);
    }
    try {
      all.push(...(await collectYoutube(recentTitles, extraPool)));
    } catch (err) {
      console.warn(`⚠️  유튜브 수집 실패, 건너뜀: ${err.message}`);
    }
    try {
      all.push(...(await collectBlogs(recentTitles, extraPool)));
    } catch (err) {
      console.warn(`⚠️  블로그 수집 실패, 건너뜀: ${err.message}`);
    }
    try {
      all.push(...(await collectPatents()));
    } catch (err) {
      console.warn(`⚠️  특허 수집 실패, 건너뜀: ${err.message}`);
    }

    if (all.length === 0) {
      console.log('수집된 기사가 없습니다. 종료.');
      return;
    }
    // 요약: 소스별 건수
    const bySrc = all.reduce((acc, a) => {
      acc[a.section] = (acc[a.section] || 0) + 1;
      return acc;
    }, {});
    console.log('[요약]', JSON.stringify(bySrc));

    // Gemini 무료 티어로 2문장 요약 채우기(GEMINI_API_KEY 없으면 자동 생략 → summary_ko 전부 null)
    const summarized = await summarizeAll(all);

    if (NO_DB) {
      // Supabase 저장/조회 없이, 방금 수집한 내용만으로 로컬 리포트 생성
      const collectedFor = ymd(new Date());
      const reportArticles = summarized.map((a) => ({
        title: a.title,
        category: a.category,
        abstract: a.abstract,
        nyt_url: a.url,
        published_at: a.pub_date ? new Date(a.pub_date).toISOString() : null,
        collected_for: collectedFor,
      }));
      const { csv, incidentCount, trendCount } = buildCsv(reportArticles);
      const filePath = writeReportFile(collectedFor, csv);
      console.log(
        `[리포트] ${filePath} 생성 완료 (사고 ${incidentCount}건, 동향 ${trendCount}건) — DB 미사용`
      );
      console.log('✅ 수집·리포트 성공 (DB 저장 생략)');
    } else {
      await save(summarized);
      await generateReport();
      console.log('✅ 전체 파이프라인 성공');
    }
  } catch (err) {
    console.error('❌ 실패:', err.message);
    process.exitCode = 1;
  } finally {
    // pg Pool 이 커넥션을 열어둔 채로 있으면 프로세스가 안 끝나므로 명시적으로 정리.
    await require('./db').closePool();
  }
})();
