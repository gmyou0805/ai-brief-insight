// 유튜브 수집 — 채널별 RSS 피드 (API 키 불필요).
// https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
//
// 기본 채널(큐레이션) + 사용자가 팔로우한 채널(follows 테이블, source_type='youtube')을 합쳐서 수집.
const { fetchText, tag, attr, normalizeTitle, atomEntryBlocks } = require('./util');
const { COMBINED_RULES, matchCategory, hasCoreRelevance } = require('./rules');

const TOP_N_PER_CHANNEL = 3;

// 큐레이션 기본 채널(AI·보안 관련, RSS 동작 확인됨)
const DEFAULT_CHANNELS = [
  { id: 'UCS64aiIcAPJiEERKWOM3bXA', label: '김덕진의 AI디아' },
  { id: 'UCa1fMK5V8Kwg46om03OC0EA', label: '미래채널 MyF' },
  { id: 'UChu25pJgVZB3p0dVEgmU0PQ', label: '메타코드M' },
  { id: 'UCUpJs89fSBXNolQGOYKn0YQ', label: '노마드 코더 Nomad Coders' },
  { id: 'UCQNE2JmbasNYbjGAcuBiRRg', label: '조코딩 JoCoding' },
  { id: 'UCxKaTFMQcCg4kA_oHLGbNxQ', label: 'AI타임즈' },
  { id: 'UCSPMRoAphbObUYeDaX367Fg', label: 'SOD' },
];

async function loadFollowedChannels(pool) {
  if (!pool) return [];
  try {
    const { rows } = await pool.query(
      `select distinct target_url as id, label
       from follows
       where source_type = 'youtube'`
    );
    return rows;
  } catch (err) {
    console.warn(`⚠️  팔로우 유튜브 채널 조회 실패: ${err.message}`);
    return [];
  }
}

// 기본 채널 + 팔로우 채널 합치기(같은 채널ID면 팔로우쪽 라벨 우선)
function mergeChannels(followed) {
  const map = new Map(DEFAULT_CHANNELS.map((c) => [c.id, c.label]));
  for (const c of followed) {
    if (c.id) map.set(c.id, c.label || c.id);
  }
  return Array.from(map, ([id, label]) => ({ id, label }));
}

async function collectYoutube(recentTitles, pool) {
  const channels = mergeChannels(await loadFollowedChannels(pool));
  const out = [];

  for (const ch of channels) {
    try {
      const xml = await fetchText(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(ch.id)}`
      );
      const blocks = atomEntryBlocks(xml);

      let picked = 0;
      for (const block of blocks) {
        if (picked >= TOP_N_PER_CHANNEL) break;
        const title = tag(block, 'title');
        const url = attr(block, 'link', 'href');
        if (!title || !url) continue;
        if (url.includes('/shorts/')) continue; // 쇼츠 제외, 일반 동영상만 수집
        if (recentTitles.has(normalizeTitle(title))) continue;

        const abstract = tag(block, 'media:description');
        const rawMatch = matchCategory(title, abstract, COMBINED_RULES);
        const category = rawMatch && hasCoreRelevance(title, abstract) ? rawMatch : '기타';
        const image_url = attr(block, 'media:thumbnail', 'url') || null;

        out.push({
          title,
          url,
          abstract,
          pub_date: tag(block, 'published'),
          rank: picked + 1,
          category,
          content_type: 'youtube',
          section: ch.label,
          image_url,
          source_links: [{ label: `${ch.label} 영상`, url }],
        });
        picked++;
      }
      console.log(`[유튜브] ${ch.label} — ${picked}건 선정`);
    } catch (err) {
      console.warn(`⚠️  유튜브 채널 수집 실패(${ch.label}): ${err.message}`);
    }
  }
  return out;
}

module.exports = { collectYoutube };
