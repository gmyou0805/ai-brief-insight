'use client';

import { useEffect, useState } from 'react';

type SourceType = 'news' | 'blog' | 'youtube';

type Follow = {
  id: number;
  source_type: SourceType;
  target_url: string;
  label: string | null;
  created_at: string;
};

type DefaultNews = { url: string; label: string };
type DefaultBlog = { url: string; label: string };
type DefaultYoutube = { id: string; label: string };

const TYPE_LABELS: Record<SourceType, string> = {
  news: '뉴스',
  blog: '블로그',
  youtube: '유튜브',
};

export default function FollowsManager({
  defaultNews,
  defaultBlogs,
  defaultYoutube,
}: {
  defaultNews: readonly DefaultNews[];
  defaultBlogs: readonly DefaultBlog[];
  defaultYoutube: readonly DefaultYoutube[];
}) {
  const [follows, setFollows] = useState<Follow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceType, setSourceType] = useState<SourceType>('news');
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  async function loadFollows() {
    setLoading(true);
    try {
      const res = await fetch('/api/follows');
      const json = await res.json();
      setFollows(res.ok ? (json.follows ?? []) : []);
    } catch {
      setFollows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFollows();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!url.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType, url: url.trim(), label: label.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? '추가에 실패했어요.');
        return;
      }
      setUrl('');
      setLabel('');
      await loadFollows();
    } catch {
      setError('네트워크 오류가 발생했어요.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    setFollows((prev) => prev.filter((f) => f.id !== id));
    try {
      await fetch(`/api/follows/${id}`, { method: 'DELETE' });
    } catch {
      loadFollows(); // 실패 시 원래 목록으로 복구
    }
  }

  const defaultUrls: Record<SourceType, Set<string>> = {
    news: new Set(defaultNews.map((n) => n.url)),
    blog: new Set(defaultBlogs.map((b) => b.url)),
    youtube: new Set(defaultYoutube.map((c) => c.id)),
  };

  // 기본 채널의 URL/ID를 오버라이드하는 follow 행(사용자가 이름을 바꾼 기본 채널)을 찾는다.
  function findOverride(type: SourceType, targetUrl: string) {
    return follows.find((f) => f.source_type === type && f.target_url === targetUrl) ?? null;
  }

  // 기본 채널 URL/ID와 겹치지 않는 진짜 사용자 추가 채널만 "내 채널"에 표시한다.
  const myFollows = follows.filter((f) => !defaultUrls[f.source_type].has(f.target_url));

  function startEdit(key: string, currentLabel: string) {
    setEditingKey(key);
    setEditValue(currentLabel);
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditValue('');
  }

  async function saveFollowEdit(id: number, previousLabel: string) {
    const nextLabel = editValue.trim();
    if (!nextLabel) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/follows/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: nextLabel, previousLabel }),
      });
      if (res.ok) {
        setFollows((prev) => prev.map((f) => (f.id === id ? { ...f, label: nextLabel } : f)));
        cancelEdit();
      }
    } finally {
      setSavingEdit(false);
    }
  }

  // 기본 채널 이름 수정: 이미 오버라이드가 있으면 PATCH, 없으면 새 follow로 추가(POST)해서 override를 만든다.
  // 현재 화면에 보이는 이름(previousLabel)도 같이 보내서, 서버가 이미 수집된 기사들의 채널 표시도 함께 갱신하게 한다.
  async function saveDefaultEdit(type: SourceType, targetUrl: string, previousLabel: string) {
    const nextLabel = editValue.trim();
    if (!nextLabel) return;
    const existing = findOverride(type, targetUrl);
    setSavingEdit(true);
    try {
      if (existing) {
        const res = await fetch(`/api/follows/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: nextLabel, previousLabel }),
        });
        if (res.ok) {
          setFollows((prev) =>
            prev.map((f) => (f.id === existing.id ? { ...f, label: nextLabel } : f))
          );
          cancelEdit();
        }
      } else {
        const res = await fetch('/api/follows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceType: type,
            url: targetUrl,
            label: nextLabel,
            previousLabel,
          }),
        });
        const json = await res.json();
        if (res.ok && json.follow) {
          setFollows((prev) => [json.follow, ...prev]);
          cancelEdit();
        }
      }
    } finally {
      setSavingEdit(false);
    }
  }

  // "기본 제공 채널" 한 섹션(뉴스/블로그/유튜브 공통)을 그린다.
  function renderDefaultSection<T extends { label: string }>(
    heading: string,
    type: SourceType,
    items: readonly T[],
    getId: (item: T) => string,
    getHref: (item: T) => string
  ) {
    return (
      <div className="default-channel-group">
        <h3 className="default-channel-heading">
          {heading} ({items.length})
        </h3>
        <ul className="follows-list">
          {items.map((item) => {
            const id = getId(item);
            const key = `${type}:${id}`;
            const override = findOverride(type, id);
            const displayLabel = override?.label || item.label;
            return (
              <li key={key} className="follows-row">
                <span className="follows-type-tag">{TYPE_LABELS[type]}</span>
                {editingKey === key ? (
                  <>
                    <input
                      className="follows-edit-input"
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveDefaultEdit(type, id, displayLabel);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="follows-edit-save"
                      onClick={() => saveDefaultEdit(type, id, displayLabel)}
                      disabled={savingEdit}
                      aria-label="이름 저장"
                      title="저장"
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      className="follows-edit-cancel"
                      onClick={cancelEdit}
                      aria-label="편집 취소"
                      title="취소"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <span className="follows-name">{displayLabel}</span>
                    <a
                      className="follows-url"
                      href={getHref(item)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {id}
                    </a>
                    <button
                      type="button"
                      className="follows-edit-btn"
                      onClick={() => startEdit(key, displayLabel)}
                      aria-label="이름 수정"
                      title="이름 수정"
                    >
                      ✎
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="follows-manager">
      <form className="follows-form" onSubmit={handleSubmit}>
        <select
          className="select-pill"
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value as SourceType)}
          aria-label="채널 유형"
        >
          <option value="news">뉴스</option>
          <option value="blog">블로그</option>
          <option value="youtube">유튜브</option>
        </select>
        <input
          className="login-input follows-url-input"
          type="text"
          placeholder={
            sourceType === 'youtube'
              ? '유튜브 채널 URL 또는 @핸들'
              : 'RSS 피드 주소 (예: https://example.com/feed)'
          }
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <input
          className="login-input follows-label-input"
          type="text"
          placeholder="이름(선택, 비우면 자동 인식)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button type="submit" className="follows-add-btn" disabled={submitting}>
          {submitting ? '추가 중…' : '추가'}
        </button>
      </form>
      {error && <p className="login-error">{error}</p>}

      <h3 className="default-channel-heading">내 채널</h3>
      {loading ? (
        <p className="result-info">불러오는 중…</p>
      ) : myFollows.length === 0 ? (
        <div className="empty">
          <p>아직 추가한 채널이 없어요.</p>
          <p className="empty-sub">위에서 뉴스·블로그·유튜브 채널을 추가해 보세요.</p>
        </div>
      ) : (
        <ul className="follows-list">
          {myFollows.map((f) => {
            const key = `follow:${f.id}`;
            return (
              <li key={key} className="follows-row">
                <span className="follows-type-tag">{TYPE_LABELS[f.source_type]}</span>
                {editingKey === key ? (
                  <>
                    <input
                      className="follows-edit-input"
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveFollowEdit(f.id, f.label || f.target_url);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="follows-edit-save"
                      onClick={() => saveFollowEdit(f.id, f.label || f.target_url)}
                      disabled={savingEdit}
                      aria-label="이름 저장"
                      title="저장"
                    >
                      ✓
                    </button>
                    <button
                      type="button"
                      className="follows-edit-cancel"
                      onClick={cancelEdit}
                      aria-label="편집 취소"
                      title="취소"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <span className="follows-name">{f.label || f.target_url}</span>
                    <a
                      className="follows-url"
                      href={
                        f.source_type === 'youtube'
                          ? `https://www.youtube.com/channel/${f.target_url}`
                          : f.target_url
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {f.target_url}
                    </a>
                    <button
                      type="button"
                      className="follows-edit-btn"
                      onClick={() => startEdit(key, f.label || '')}
                      aria-label="이름 수정"
                      title="이름 수정"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="follows-remove-btn"
                      onClick={() => handleDelete(f.id)}
                      aria-label="삭제"
                      title="삭제"
                    >
                      ✕
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="settings-subtitle">기본 제공 채널은 이름만 수정 가능(직접 삭제 불가)</p>

      {renderDefaultSection(
        '뉴스',
        'news',
        defaultNews,
        (n) => n.url,
        (n) => n.url
      )}
      {renderDefaultSection(
        '블로그',
        'blog',
        defaultBlogs,
        (b) => b.url,
        (b) => b.url
      )}
      {renderDefaultSection(
        '유튜브',
        'youtube',
        defaultYoutube,
        (c) => c.id,
        (c) => `https://www.youtube.com/channel/${c.id}`
      )}
    </div>
  );
}
