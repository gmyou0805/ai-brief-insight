// 기본 제공(큐레이션) 채널 목록 — /settings 화면 표시용.
// 실제 수집 로직은 scripts/fetch_and_summarize.js(뉴스), scripts/collectors/blogs.js,
// scripts/collectors/youtube.js 에 있고, 이 파일은 그 목록을 화면에 보여주기 위한 사본이다
// (동일하게 유지할 것).

export const DEFAULT_NEWS = [
  { url: 'https://www.aitimes.com/rss/allArticle.xml', label: 'AI타임즈' },
  { url: 'https://www.dailysecu.com/rss/allArticle.xml', label: '데일리시큐' },
  { url: 'https://www.datanet.co.kr/rss/allArticle.xml', label: '데이터넷' },
  { url: 'http://rss.etnews.com/04.xml', label: '전자신문' },
  { url: 'https://www.gttkorea.com/rss/S2N1.xml', label: '지티티코리아' },
] as const;

export const DEFAULT_BLOGS = [
  { url: 'https://blog.alyac.co.kr/feed', label: '알약 블로그(이스트시큐리티)' },
  { url: 'https://d2.naver.com/d2.atom', label: '네이버 D2' },
  { url: 'https://tech.kakao.com/feed/', label: '카카오테크' },
  { url: 'https://techblog.woowahan.com/feed/', label: '우아한형제들 기술블로그' },
  { url: 'https://toss.tech/rss.xml', label: '토스 기술 블로그' },
  { url: 'https://www.techblogposts.com/rss.xml', label: 'TechBlogPosts' },
  { url: 'https://techblog.lycorp.co.jp/ko/feed/index.xml', label: 'LY Corporation Tech Blog' },
  { url: 'https://medium.com/feed/coupang-engineering', label: '쿠팡 엔지니어링' },
  { url: 'https://helloworld.kurly.com/rss.xml', label: '컬리 기술 블로그' },
  { url: 'https://medium.com/feed/daangn', label: '당근 기술 블로그' },
  { url: 'https://flex.team/blog/rss.xml', label: 'flex 기술 블로그' },
  { url: 'https://openai.com/news/rss.xml', label: 'Open AI' },
  { url: 'https://medium.com/feed/watcha', label: '왓챠 미디어' },
] as const;

export const DEFAULT_YOUTUBE_CHANNELS = [
  { id: 'UCS64aiIcAPJiEERKWOM3bXA', label: '김덕진의 AI디아' },
  { id: 'UCa1fMK5V8Kwg46om03OC0EA', label: '미래채널 MyF' },
  { id: 'UChu25pJgVZB3p0dVEgmU0PQ', label: '메타코드M' },
  { id: 'UCUpJs89fSBXNolQGOYKn0YQ', label: '노마드 코더 Nomad Coders' },
  { id: 'UCQNE2JmbasNYbjGAcuBiRRg', label: '조코딩 JoCoding' },
  { id: 'UCxKaTFMQcCg4kA_oHLGbNxQ', label: 'AI타임즈' },
  { id: 'UCSPMRoAphbObUYeDaX367Fg', label: 'SOD' },
] as const;
