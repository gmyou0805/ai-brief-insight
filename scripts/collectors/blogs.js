// 블로그 수집 — 개별 블로그 RSS/Atom 피드 (API 키 불필요).
// 기본 블로그(큐레이션) + 사용자가 팔로우한 블로그(follows 테이블, source_type='blog')를 합쳐서 수집.
const { fetchText, tag, attr, normalizeTitle, rssItemBlocks, atomEntryBlocks } = require('./util');
const { COMBINED_RULES, matchCategory, hasCoreRelevance } = require('./rules');

const TOP_N_PER_BLOG = 3;

// 큐레이션 기본 블로그(AI·보안 관련, 피드 동작 확인됨)
const DEFAULT_BLOGS = [
  { url: 'https://blog.alyac.co.kr/feed', label: '알약 블로그(이스트시큐리티)', format: 'rss' },
  { url: 'https://d2.naver.com/d2.atom', label: '네이버 D2', format: 'atom' },
  { url: 'https://tech.kakao.com/feed/', label: '카카오테크', format: 'rss' },
  { url: 'https://techblog.woowahan.com/feed/', label: '우아한형제들 기술블로그', format: 'rss' },
  { url: 'https://toss.tech/rss.xml', label: '토스 기술 블로그', format: 'rss' },
  // 국내 여러 기업 기술 블로그(LINE/AWS Korea/베스핀글로벌 등)를 한데 모아주는 애그리게이터
  { url: 'https://www.techblogposts.com/rss.xml', label: 'TechBlogPosts', format: 'atom' },
  // /ja(일본어) 대신 /ko(한국어) 피드 사용 — 번역 없이 바로 한국어 콘텐츠 제공됨
  { url: 'https://techblog.lycorp.co.jp/ko/feed/index.xml', label: 'LY Corporation Tech Blog', format: 'rss' },
  { url: 'https://medium.com/feed/coupang-engineering', label: '쿠팡 엔지니어링', format: 'rss' },
  { url: 'https://helloworld.kurly.com/rss.xml', label: '컬리 기술 블로그', format: 'rss' },
  { url: 'https://medium.com/feed/daangn', label: '당근 기술 블로그', format: 'rss' },
  { url: 'https://flex.team/blog/rss.xml', label: 'flex 기술 블로그', format: 'rss' },
  { url: 'https://openai.com/news/rss.xml', label: 'Open AI', format: 'rss' },
  // 사용자가 준 URL(medium.com/watcha)은 403이라 미디엄 표준 피드 경로(/feed/)로 대체
  { url: 'https://medium.com/feed/watcha', label: '왓챠 미디어', format: 'rss' },
];

async function loadFollowedBlogs(pool) {
  if (!pool) return [];
  try {
    const { rows } = await pool.query(
      `select distinct target_url as url, label
       from follows
       where source_type = 'blog'`
    );
    // 사용자가 등록한 블로그는 포맷을 알 수 없으니 RSS 2.0으로 가정(대부분의 블로그 플랫폼 기본값)
    return rows.map((r) => ({ ...r, format: 'rss' }));
  } catch (err) {
    console.warn(`⚠️  팔로우 블로그 조회 실패: ${err.message}`);
    return [];
  }
}

function mergeBlogs(followed) {
  const map = new Map(DEFAULT_BLOGS.map((b) => [b.url, b]));
  for (const b of followed) {
    if (b.url) map.set(b.url, { url: b.url, label: b.label || b.url, format: b.format });
  }
  return Array.from(map.values());
}

function parseEntries(xml, format) {
  const blocks = format === 'atom' ? atomEntryBlocks(xml) : rssItemBlocks(xml);
  return blocks.map((block) => ({
    title: tag(block, 'title'),
    url: format === 'atom' ? attr(block, 'link', 'href') : tag(block, 'link'),
    abstract: tag(block, 'summary') || tag(block, 'description') || tag(block, 'content'),
    pub_date: tag(block, 'published') || tag(block, 'pubDate') || tag(block, 'updated'),
  }));
}

async function collectBlogs(recentTitles, pool) {
  const blogs = mergeBlogs(await loadFollowedBlogs(pool));
  const out = [];

  for (const b of blogs) {
    try {
      const xml = await fetchText(b.url);
      const items = parseEntries(xml, b.format);

      let picked = 0;
      for (const it of items) {
        if (picked >= TOP_N_PER_BLOG) break;
        if (!it.title || !it.url) continue;
        if (recentTitles.has(normalizeTitle(it.title))) continue;

        const rawMatch = matchCategory(it.title, it.abstract, COMBINED_RULES);
        const category =
          rawMatch && hasCoreRelevance(it.title, it.abstract) ? rawMatch : '기타';
        out.push({
          title: it.title,
          url: it.url,
          abstract: it.abstract,
          pub_date: it.pub_date,
          rank: picked + 1,
          category,
          content_type: 'blog',
          section: b.label,
          image_url: null,
          source_links: [{ label: `${b.label} 원문`, url: it.url }],
        });
        picked++;
      }
      console.log(`[블로그] ${b.label} — ${picked}건 선정`);
    } catch (err) {
      console.warn(`⚠️  블로그 수집 실패(${b.label}): ${err.message}`);
    }
  }
  return out;
}

module.exports = { collectBlogs };
