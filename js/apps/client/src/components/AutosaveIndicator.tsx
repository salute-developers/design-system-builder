import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { AutosaveStatus } from '../api/tokenAutosaveQueue';
import { useAnchoredPopover } from './Overlay/Overlay';

const labels: Record<AutosaveStatus, string> = {
    pending: 'Ожидает сохранения',
    saving: 'Сохраняется…',
    saved: 'Сохранено',
    error: 'Не удалось сохранить. Нажмите, чтобы повторить.',
};

const SaveIcon = ({ status }: { status: AutosaveStatus }) => (
    <svg className="editor-autosave-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M14.5 3H4a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1V8.5L14.5 3Z"
            stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M7 3v5h7V3M7 20v-7h8v7" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <circle cx="18" cy="18" r="5" fill={status === 'saved' ? '#0c9423' : status === 'error' ? '#f31b31' : 'var(--p-bg, #27282c)'}
            stroke="var(--p-bg, #27282c)" strokeWidth="1.5" />
        {status === 'saved' ? (
            <path d="m16.3 18 1.1 1.1 2.2-2.2" stroke="white" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        ) : status === 'error' ? (
            <path d="m16.2 16.2 3.6 3.6m0-3.6-3.6 3.6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        ) : status === 'saving' ? (
            <g className="editor-autosave-progress">
                <path d="M21 18a3 3 0 1 1-3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </g>
        ) : (
            <path d="M18 15.5V18l1.5 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        )}
    </svg>
);

export const AutosaveIndicator = ({ status, retry, lastSavedAt }: {
    status: AutosaveStatus;
    retry: () => void;
    lastSavedAt?: number;
}) => {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLDivElement>(null);
    const tooltipId = useId();
    const { popoverRef, style } = useAnchoredPopover(open, anchorRef, 'content');
    const savedTime = lastSavedAt !== undefined && Number.isFinite(lastSavedAt)
        ? new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(lastSavedAt)
        : undefined;
    const lastSaveLabel = savedTime ? `Последнее сохранение — ${savedTime}` : undefined;
    const hint = status === 'saved' ? lastSaveLabel ?? 'Нет несохранённых изменений'
        : [labels[status], lastSaveLabel ?? (status === 'error' ? 'Время последнего успешного сохранения неизвестно' : undefined)]
            .filter(Boolean).join('\n');

    return (
        <>
            <div ref={anchorRef} className={`editor-autosave-status is-${status}`}
                role={status === 'error' ? 'alert' : 'status'} aria-label={hint}
                aria-describedby={open ? tooltipId : undefined} tabIndex={status === 'error' ? undefined : 0}
                onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)} onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
                }} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
                {status === 'error' ? (
                    <button type="button" className="editor-autosave-retry" onClick={retry} aria-label="Повторить сохранение">
                        <SaveIcon status={status} />
                    </button>
                ) : <SaveIcon status={status} />}
            </div>
            {open && createPortal(
                <div ref={popoverRef} id={tooltipId} role="tooltip" className="editor-autosave-tooltip"
                    style={{ ...style, maxWidth: 'min(360px, calc(100vw - 16px))' }}>{hint}</div>,
                document.body,
            )}
        </>
    );
};
