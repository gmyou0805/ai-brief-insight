// 논문/블로그/유튜브 수집기가 공유하는 저수준 fetch·XML 파싱 유틸.
// scripts/fetch_and_summarize.js 의 동명 함수들과 동작은 동일(패턴 유지 목적으로 별도 모듈로 분리).

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

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

// 인코딩 자동 감지 디코딩(대부분 UTF-8, 일부 구형 사이트만 EUC-KR)
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

// block(문자열) 안에서 <name>...</name> 의 첫 매치 텍스트(엔티티 디코딩됨)
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeEntities(m[1]) : '';
}

// block 안에서 <tagName ... attrName="값" ...> 의 첫 매치 속성값(엔티티 디코딩됨)
function attr(block, tagName, attrName) {
  const m = block.match(new RegExp(`<${tagName}[^>]*\\b${attrName}=["']([^"']+)["']`, 'i'));
  return m ? decodeEntities(m[1]) : '';
}

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .trim();
}

// RSS 2.0 <item>...</item> 블록 목록
function rssItemBlocks(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
}

// Atom <entry>...</entry> 블록 목록 (arXiv, 네이버 D2, 유튜브 채널 피드 등)
function atomEntryBlocks(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map((m) => m[1]);
}

module.exports = {
  UA,
  fetchText,
  tag,
  attr,
  decodeEntities,
  normalizeTitle,
  rssItemBlocks,
  atomEntryBlocks,
};
