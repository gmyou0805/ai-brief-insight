'use client';

import { useEffect, useRef, useState } from 'react';
import { formatDateDot } from '@/lib/date';

const PRESETS = ['전체', '1일', '1주', '1개월', '3개월', '6개월'] as const;
type Preset = (typeof PRESETS)[number];

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysStr(base: string, days: number): string {
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function presetRange(p: Preset): [string | null, string | null] {
  const today = todayStr();
  switch (p) {
    case '1일':
      return [today, today];
    case '1주':
      return [addDaysStr(today, -6), today];
    case '1개월':
      return [addDaysStr(today, -29), today];
    case '3개월':
      return [addDaysStr(today, -89), today];
    case '6개월':
      return [addDaysStr(today, -179), today];
    default:
      return [null, null];
  }
}

// 초안 범위가 프리셋 중 하나와 정확히 일치하면 그 프리셋을 강조, 아니면(직접 선택한 범위) 아무것도 강조 안 함
function detectPreset(from: string | null, to: string | null): Preset | null {
  if (!from && !to) return '전체';
  for (const p of PRESETS) {
    if (p === '전체') continue;
    const [f, t] = presetRange(p);
    if (f === from && t === to) return p;
  }
  return null;
}

export default function DateFilterPopover({
  from,
  to,
  onApply,
}: {
  from: string | null;
  to: string | null;
  onApply: (from: string | null, to: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<string | null>(from);
  const [draftTo, setDraftTo] = useState<string | null>(to);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraftFrom(from);
    setDraftTo(to);
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function applyPreset(p: Preset) {
    const [f, t] = presetRange(p);
    setDraftFrom(f);
    setDraftTo(t);
  }

  const activePreset = detectPreset(draftFrom, draftTo);

  const label =
    !from && !to
      ? '날짜 전체'
      : `${from ? formatDateDot(from) : '…'} ~ ${to ? formatDateDot(to) : '…'}`;

  return (
    <div className="filter-popover-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`select-pill${from || to ? ' active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {label} <span aria-hidden="true">📅</span>
      </button>
      {open && (
        <div className="filter-popover date-popover">
          <div className="popover-presets">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`popover-preset${activePreset === p ? ' active' : ''}`}
                onClick={() => applyPreset(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="popover-range">
            <input
              type="date"
              className="popover-date-input"
              value={draftFrom ?? ''}
              onChange={(e) => setDraftFrom(e.target.value || null)}
            />
            <span>~</span>
            <input
              type="date"
              className="popover-date-input"
              value={draftTo ?? ''}
              onChange={(e) => setDraftTo(e.target.value || null)}
            />
          </div>
          <div className="popover-actions">
            <button type="button" className="popover-cancel" onClick={() => setOpen(false)}>
              취소
            </button>
            <button
              type="button"
              className="popover-confirm"
              onClick={() => {
                onApply(draftFrom, draftTo);
                setOpen(false);
              }}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
