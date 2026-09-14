// 논문 수집 — arXiv API(무료, API 키 불필요) + 자체 RSS 피드를 제공하는 논문 저장소.
// https://export.arxiv.org/api_help/docs.html
const { fetchText, tag, attr, normalizeTitle, atomEntryBlocks, rssItemBlocks } = require('./util');

const MAX_RESULTS = 10; // 쿼리당 최신 논문 조회 건수
const TOP_N = 4; // 쿼리당 최종 채택 건수

// cs.CR(암호·보안), cs.AI/cs.LG(인공지능·머신러닝) 최신 논문을 각각 조회
const QUERIES = [
  { query: 'cat:cs.CR', category: '취약점·제로데이', label: 'arXiv(보안)' },
  { query: 'cat:cs.AI OR cat:cs.LG', category: '연구·기술', label: 'arXiv(AI)' },
];

// arXiv API 외에 자체 RSS 피드를 제공하는 논문 저장소(암호·보안 전문, 피드 동작 확인됨)
const RSS_SOURCES = [
  {
    url: 'https://eprint.iacr.org/rss/rss.xml',
    category: '취약점·제로데이',
    label: 'IACR ePrint(암호)',
  },
];

function clean(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

async function collectArxivQuery(q, recentTitles) {
  const out = [];
  const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(
    q.query
  )}&sortBy=submittedDate&sortOrder=descending&max_results=${MAX_RESULTS}`;
  const xml = await fetchText(url);
  const blocks = atomEntryBlocks(xml);

  let picked = 0;
  for (const block of blocks) {
    if (picked >= TOP_N) break;
    const title = clean(tag(block, 'title'));
    const url_ = attr(block, 'link', 'href');
    if (!title || !url_) continue;
    if (recentTitles.has(normalizeTitle(title))) continue;

    out.push({
      title,
      url: url_,
      abstract: clean(tag(block, 'summary')),
      pub_date: tag(block, 'published'),
      rank: picked + 1,
      category: q.category,
      content_type: 'paper',
      section: q.label,
      image_url: null,
      source_links: [{ label: '논문 원문(arXiv)', url: url_ }],
    });
    picked++;
  }
  console.log(`[논문] ${q.label} — ${picked}건 선정`);
  return out;
}

async function collectRssSource(src, recentTitles) {
  const out = [];
  const xml = await fetchText(src.url);
  const blocks = rssItemBlocks(xml);

  let picked = 0;
  for (const block of blocks) {
    if (picked >= TOP_N) break;
    const title = clean(tag(block, 'title'));
    const url_ = tag(block, 'link');
    if (!title || !url_) continue;
    if (recentTitles.has(normalizeTitle(title))) continue;

    out.push({
      title,
      url: url_,
      abstract: clean(tag(block, 'description')),
      pub_date: tag(block, 'pubDate'),
      rank: picked + 1,
      category: src.category,
      content_type: 'paper',
      section: src.label,
      image_url: null,
      source_links: [{ label: `논문 원문(${src.label})`, url: url_ }],
    });
    picked++;
  }
  console.log(`[논문] ${src.label} — ${picked}건 선정`);
  return out;
}

async function collectPapers(recentTitles) {
  const out = [];
  for (const q of QUERIES) {
    try {
      out.push(...(await collectArxivQuery(q, recentTitles)));
    } catch (err) {
      console.warn(`⚠️  논문 수집 실패(${q.label}): ${err.message}`);
    }
  }
  for (const src of RSS_SOURCES) {
    try {
      out.push(...(await collectRssSource(src, recentTitles)));
    } catch (err) {
      console.warn(`⚠️  논문 수집 실패(${src.label}): ${err.message}`);
    }
  }
  return out;
}

module.exports = { collectPapers };
