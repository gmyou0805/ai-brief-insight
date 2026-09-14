'use client';

import { useEffect, useState } from 'react';
import { type Article } from '@/lib/db';
import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  type ContentType,
  type Field,
} from '@/lib/categories';
import ArticleItem from './ArticleItem';
import FieldFilterPopover from './FieldFilterPopover';
import DateFilterPopover from './DateFilterPopover';

const ALL = '전체';
const PAGE_SIZE = 30;

// 페이지 버튼 목록(너무 많으면 가운데 생략 "…")
function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = Array.from(keep)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}

export default function Browser({
  initialArticles,
  dateLabel,
  todayDate,
}: {
  initialArticles: Article[];
  dateLabel?: string | null;
  todayDate?: string | null;
}) {
  // 채널(콘텐츠 유형)은 왼쪽 사이드바에서 하나만 고르는 단일 선택 — 빈 배열이면 전체
  const [activeType, setActiveType] = useState<ContentType | typeof ALL>(ALL);
  const selectedTypes = activeType === ALL ? [] : [activeType];
  // 채널 유형 아래 세부 출처(예: 뉴스 → AI타임즈) — 유형별 현재 실제 수집 중인 출처 목록
  const [channelsByType, setChannelsByType] = useState<Record<string, string[]>>({});
  const [activeSource, setActiveSource] = useState<string | null>(null);
  // 세부 출처 목록이 펼쳐져 있는 유형 — 같은 채널을 다시 클릭하면 목록만 접힘(필터는 유지)
  const [expandedType, setExpandedType] = useState<ContentType | null>(null);
  const [selectedFields, setSelectedFields] = useState<Field[]>([]);
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [rawQuery, setRawQuery] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const [results, setResults] = useState<Article[]>(initialArticles);
  const [totalCount, setTotalCount] = useState(initialArticles.length);
  const [loading, setLoading] = useState(false);

  // 검색어 디바운스(입력 멈춘 뒤 300ms)
  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [rawQuery]);

  // 채널 유형별 세부 출처 목록(최초 1회) — 사이드바에서 뉴스/블로그/유튜브를 펼칠 때 사용
  useEffect(() => {
    let cancelled = false;
    fetch('/api/channels')
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setChannelsByType(json.channels ?? {});
      })
      .catch(() => {
        if (!cancelled) setChannelsByType({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 채널 유형을 바꾸면 세부 출처 선택 초기화(유형마다 출처 목록 의미가 다름).
  // 이미 선택·펼쳐진 채널을 다시 클릭하면 필터는 그대로 두고 목록만 접는다.
  function selectType(t: ContentType | typeof ALL) {
    if (t === activeType && t === expandedType) {
      setExpandedType(null);
      return;
    }
    setActiveType(t);
    setActiveSource(null);
    setExpandedType(t === ALL ? null : t);
  }

  // 필터가 바뀌면 1페이지로
  useEffect(() => {
    setPage(1);
  }, [activeType, activeSource, selectedFields, dateFrom, dateTo, query]);

  // 기본 화면(오늘 전체) 여부 — 아무 필터·검색·페이지 이동이 없을 때
  const isDefault =
    activeType === ALL &&
    !activeSource &&
    selectedFields.length === 0 &&
    !dateFrom &&
    !dateTo &&
    query === '' &&
    page === 1;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (isDefault) {
        setResults(initialArticles);
        setTotalCount(initialArticles.length);
        return;
      }
      setLoading(true);

      const params = new URLSearchParams();
      if (selectedTypes.length > 0) params.set('type', selectedTypes.join(','));
      if (activeSource) params.set('source', activeSource);
      if (selectedFields.length > 0) params.set('field', selectedFields.join(','));
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      if (query) params.set('q', query);
      params.set('page', String(page));

      try {
        const res = await fetch(`/api/articles?${params.toString()}`);
        const json = await res.json();
        if (!cancelled) {
          setResults(res.ok ? ((json.data as Article[]) ?? []) : []);
          setTotalCount(res.ok ? (json.count ?? 0) : 0);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
          setTotalCount(0);
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [
    activeType,
    activeSource,
    selectedFields,
    dateFrom,
    dateTo,
    query,
    page,
    isDefault,
    initialArticles,
  ]);

  const totalPages = isDefault ? 1 : Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // 펼쳐진 채널 유형의 세부 출처 버튼 목록("전체" + 실제 수집 중인 출처들). 데스크톱(탭 아래)과
  // 모바일(탭 줄 전체 아래 고정 위치) 두 곳에서 같은 목록을 재사용한다.
  function renderSubItems(sources: string[]) {
    return (
      <>
        <button
          className={`side-subitem${!activeSource ? ' active' : ''}`}
          onClick={() => setActiveSource(null)}
        >
          전체
        </button>
        {sources.map((s) => (
          <button
            key={s}
            className={`side-subitem${activeSource === s ? ' active' : ''}`}
            onClick={() => setActiveSource(s)}
          >
            {s}
          </button>
        ))}
      </>
    );
  }

  const expandedSources = expandedType ? (channelsByType[expandedType] ?? []) : [];

  return (
    <div className="layout">
      {/* 좌측 채널 사이드바 */}
      <aside className="sidebar" aria-label="채널">
        <nav className="side-nav" role="tablist" aria-label="채널 선택">
          <button
            role="tab"
            aria-selected={activeType === ALL}
            className={`side-item${activeType === ALL ? ' active' : ''}`}
            onClick={() => selectType(ALL)}
          >
            채널
          </button>
          {CONTENT_TYPES.map((t) => {
            const sources = channelsByType[t] ?? [];
            const isActive = activeType === t;
            return (
              <div key={t} className="side-group">
                <button
                  role="tab"
                  aria-selected={isActive}
                  className={`side-item${isActive ? ' active' : ''}`}
                  onClick={() => selectType(t)}
                >
                  {CONTENT_TYPE_LABELS[t]}
                </button>
                {/* 데스크톱 전용 — 해당 탭 바로 아래에 펼침(세로 목록이라 다른 탭 위치에 영향 없음).
                    모바일은 탭 줄이 가로로 wrap되어 있어 탭 사이에 끼면 뒤 탭들이 밀리므로,
                    모바일에서는 이 블록을 숨기고 탭 줄 전체 아래의 공용 블록을 대신 보여준다. */}
                {expandedType === t && sources.length > 0 && (
                  <div className="side-subnav side-subnav-desktop">
                    {renderSubItems(sources)}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        {/* 모바일 전용 — 탭 줄 위치가 안 흔들리도록 어떤 탭을 펼쳐도 항상 탭 줄 바로 아래 한 곳에 표시 */}
        {expandedType && expandedSources.length > 0 && (
          <div className="side-subnav side-subnav-mobile">{renderSubItems(expandedSources)}</div>
        )}
      </aside>

      <div className="content">
        {/* 제목 + 날짜 */}
        <div className="content-head-row">
          <h2 className="content-title">인사이트</h2>
          {dateLabel && <span className="content-date">{dateLabel}</span>}
        </div>

        {/* 분야·날짜 필터 + 검색창 */}
        <div className="filter-row filter-row-select">
          <div className="filter-selects">
            <FieldFilterPopover value={selectedFields} onApply={setSelectedFields} />
            <DateFilterPopover
              from={dateFrom}
              to={dateTo}
              onApply={(f, t) => {
                setDateFrom(f);
                setDateTo(t);
              }}
            />
          </div>

          <div className="search">
            <span className="search-icon" aria-hidden="true">
              🔍
            </span>
            <input
              className="search-input"
              type="search"
              placeholder="동향 검색"
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              aria-label="뉴스 검색"
            />
            {rawQuery && (
              <button
                className="search-clear"
                onClick={() => setRawQuery('')}
                aria-label="검색어 지우기"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 결과 안내 */}
        {!isDefault && (
          <p className="result-info">
            {loading
              ? '검색 중…'
              : `결과 ${totalCount}건${totalPages > 1 ? ` · ${page}/${totalPages}페이지` : ''}`}
          </p>
        )}

        {results.length === 0 ? (
          <div className="empty">
            <p>결과가 없어요.</p>
            <p className="empty-sub">다른 검색어나 필터를 시도해 보세요.</p>
          </div>
        ) : (
          <ul className="insight-list">
            {results.map((a) => (
              <ArticleItem key={a.id} article={a} todayDate={todayDate} />
            ))}
          </ul>
        )}

        {/* 페이지네이션 */}
        {!isDefault && totalPages > 1 && (
          <nav className="pager" aria-label="페이지 이동">
            <button
              className="pager-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="이전 페이지"
            >
              ‹
            </button>
            {pageNumbers(page, totalPages).map((p, i) =>
              p === '…' ? (
                <span key={`e${i}`} className="pager-ellipsis">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  className={`pager-btn${p === page ? ' active' : ''}`}
                  aria-current={p === page ? 'page' : undefined}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            )}
            <button
              className="pager-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="다음 페이지"
            >
              ›
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}

