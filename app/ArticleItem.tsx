import type { Article } from '@/lib/db';
import { formatDateDot } from '@/lib/date';
import { summaryBullets } from '@/lib/summary';
import { fieldOf, fieldColorClass } from '@/lib/categories';

export default function ArticleItem({
  article,
  todayDate,
}: {
  article: Article;
  // 사이트가 인식하는 "오늘"(가장 최근 수집일, YYYY-MM-DD) — 브라우저 시계가 아니라
  // 서버에서 내려준 값과 비교해야 시간대 차이로 TODAY 배지가 어긋나지 않는다.
  todayDate?: string | null;
}) {
  const dateSource = article.published_at ?? article.collected_for;
  const dateLabel = formatDateDot(dateSource);
  const bullets = summaryBullets(article);
  const field = fieldOf(article);
  const isToday = !!todayDate && !!dateSource && dateSource.slice(0, 10) === todayDate;

  return (
    <li className="insight-row">
      {article.image_url && (
        <a
          href={article.nyt_url}
          target="_blank"
          rel="noopener noreferrer"
          className="insight-thumb-link"
          tabIndex={-1}
          aria-hidden="true"
        >
          <img src={article.image_url} alt="" className="insight-thumb" loading="lazy" />
        </a>
      )}
      <div className="insight-body">
        <div className="insight-top">
          <a
            href={article.nyt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="insight-title"
          >
            {article.title}
            {isToday && <span className="today-badge">TODAY</span>}
            <span className="ext" aria-hidden="true">
              ↗
            </span>
          </a>
          <span className="insight-date">{dateLabel}</span>
        </div>
        {bullets.length > 0 && (
          <ul className="insight-summary">
            {bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        )}
        <div className="insight-meta">
          <span className={`insight-field cat-${fieldColorClass(field)}`}>{field}</span>
          {article.section && (
            <span
              className={`insight-source${
                article.section === '보안뉴스' || article.section === '데일리시큐'
                  ? ' sec-security'
                  : ''
              }`}
            >
              {article.section}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
