'use client';

import { useEffect, useRef, useState } from 'react';
import { FIELDS, type Field } from '@/lib/categories';

export default function FieldFilterPopover({
  value,
  onApply,
}: {
  value: Field[];
  onApply: (fields: Field[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Field[]>(value);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggle(f: Field) {
    setDraft((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  const label = value.length === 0 ? '분야 전체' : `분야 ${value.length}`;

  return (
    <div className="filter-popover-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`select-pill${value.length > 0 ? ' active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {label}
      </button>
      {open && (
        <div className="filter-popover">
          <div className="popover-head">
            <span>선택 {draft.length}</span>
            <button type="button" className="popover-reset" onClick={() => setDraft([])}>
              ↻ 초기화
            </button>
          </div>
          <div className="popover-grid">
            {FIELDS.map((f) => (
              <label key={f} className="popover-check">
                <input type="checkbox" checked={draft.includes(f)} onChange={() => toggle(f)} />
                {f}
              </label>
            ))}
          </div>
          <div className="popover-actions">
            <button type="button" className="popover-cancel" onClick={() => setOpen(false)}>
              취소
            </button>
            <button
              type="button"
              className="popover-confirm"
              onClick={() => {
                onApply(draft);
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
