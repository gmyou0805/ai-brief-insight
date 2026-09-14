// 신규 기본 유튜브 채널 초기 수집(1회성) — 기본 채널 목록을 바꾼 직후,
// 다음날 정기 수집(매일 09:00 KST)을 기다리지 않고 바로 화면에 보이도록 시드 데이터를 채운다.
// 실행: node scripts/seed_new_youtube_defaults.js
try {
  require('dotenv').config();
} catch (_) {
  /* ignore */
}

const { getPool, closePool } = require('./db');
const { collectYoutube } = require('./collectors/youtube');

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

(async () => {
  const pool = getPool();
  try {
    const articles = await collectYoutube(new Set(), pool);
    console.log(`[유튜브 시드] 수집된 영상 ${articles.length}건`);

    const rankByDay = new Map();
    const rows = articles.map((a) => {
      const collectedFor = a.pub_date ? ymd(new Date(a.pub_date)) : ymd(new Date());
      const rank = (rankByDay.get(collectedFor) ?? 0) + 1;
      rankByDay.set(collectedFor, rank);
      return {
        nyt_url: a.url,
        rank,
        title: a.title,
        abstract: a.abstract,
        summary_ko: null,
        category: a.category,
        image_url: a.image_url,
        byline: null,
        section: a.section,
        source_links: JSON.stringify(a.source_links ?? []),
        published_at: a.pub_date ? new Date(a.pub_date).toISOString() : null,
        collected_for: collectedFor,
        content_type: a.content_type || 'youtube',
      };
    });

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
    console.log(`✅ 유튜브 시드 완료 — 새로 저장된 영상 ${inserted}건`);
  } finally {
    await closePool();
  }
})();
