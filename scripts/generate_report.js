// 수집된 기사를 "구분(사고/동향) · 일자 · 이슈 · 링크 · 참고사항" 표 형식 CSV로 출력.
//
// 실행:  npm run report            (최신 수집일 기준)
//        npm run report 2026-08-05 (특정 날짜 기준)
// * fetch_and_summarize.js 의 collect 실행 끝에서도 자동 호출됨.

try {
  require('dotenv').config();
} catch (_) {
  /* dotenv 미설치(운영 환경) → 무시 */
}

const fs = require('fs');
const path = require('path');
const { getPool } = require('./db');

const { DATABASE_URL } = process.env;

// 보안뉴스 카테고리 중 실제 침해사고류만 "사고", 나머지(AI타임즈 전체 포함)는 "동향"
const INCIDENT_CATEGORIES = new Set(['침해사고·정보유출', '랜섬웨어·악성코드']);

function divisionOf(article) {
  return INCIDENT_CATEGORIES.has(article.category) ? '사고' : '동향';
}

// 'YYYY-MM-DD' 또는 ISO 타임스탬프 → "0805"
function mmdd(value) {
  if (!value) return '';
  const m = String(value).slice(0, 10).match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}${m[2]}` : '';
}

// abstract(RSS 원문 설명)를 문장 단위로 쪼개 상위 2개만 - 불릿으로
function bulletsFrom(abstract) {
  if (!abstract) return [];
  return abstract
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8)
    .slice(0, 2)
    .map((s) => `- ${s}`);
}

function issueCell(article) {
  return [article.title, ...bulletsFrom(article.abstract)].join('\n');
}

function csvField(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// 기사 배열({title, category, abstract, nyt_url, published_at}) → CSV 문자열
function buildCsv(articles) {
  const incidents = articles.filter((a) => divisionOf(a) === '사고');
  const trends = articles.filter((a) => divisionOf(a) === '동향');
  const ordered = [...incidents, ...trends];

  const header = ['구분', '일자', '이슈', '링크', '참고사항'];
  const rows = ordered.map((a) => [
    divisionOf(a),
    mmdd(a.published_at || a.collected_for),
    issueCell(a),
    a.nyt_url,
    '',
  ]);

  return {
    csv: [header, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n'),
    incidentCount: incidents.length,
    trendCount: trends.length,
  };
}

// CSV 문자열을 reports/<날짜>.csv 로 저장(DB 접근 없이 순수 파일 IO)
function writeReportFile(collectedFor, csv) {
  const dir = path.join(__dirname, '..', 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${collectedFor}.csv`);
  // BOM 포함 → Excel 에서 한글 깨짐 방지
  fs.writeFileSync(filePath, '﻿' + csv, 'utf-8');
  return filePath;
}

async function generateReport(dateArg) {
  if (!DATABASE_URL) {
    console.error('[설정오류] DATABASE_URL 이 없습니다.');
    return null;
  }
  const pool = getPool();

  let collectedFor = dateArg;
  if (!collectedFor) {
    const latest = await pool.query(
      'select collected_for from articles order by collected_for desc limit 1'
    );
    collectedFor = latest.rows[0]?.collected_for;
  }
  if (!collectedFor) {
    console.log('[리포트] 저장된 기사가 없습니다.');
    return null;
  }

  const { rows } = await pool.query(
    'select * from articles where collected_for = $1 order by published_at desc',
    [collectedFor]
  );

  const { csv, incidentCount, trendCount } = buildCsv(rows || []);
  const filePath = writeReportFile(collectedFor, csv);
  console.log(`[리포트] ${filePath} 생성 완료 (사고 ${incidentCount}건, 동향 ${trendCount}건)`);
  return filePath;
}

if (require.main === module) {
  generateReport(process.argv[2])
    .catch((err) => {
      console.error('❌ 리포트 생성 실패:', err.message);
      process.exitCode = 1;
    })
    .finally(() => require('./db').closePool());
}

module.exports = {
  generateReport,
  buildCsv,
  writeReportFile,
  divisionOf,
  mmdd,
  bulletsFrom,
  issueCell,
  csvField,
};
