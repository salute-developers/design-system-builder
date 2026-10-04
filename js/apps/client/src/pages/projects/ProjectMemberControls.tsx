import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { projectsApi, type ProjectMemberCandidateDto } from '../../api';
import { focusRelativeToTrigger, useAnchoredPopover } from '../../components/Overlay/Overlay';

export const ROLE_OPTIONS = ['viewer', 'editor', 'maintainer'].map((role) => ({
    value: role,
    label: role.charAt(0).toUpperCase() + role.slice(1),
}));
export const ROLE_FILTER_OPTIONS = [
    { value: 'all', label: 'Все роли' },
    { value: 'owner', label: 'Owner' },
    ...ROLE_OPTIONS,
];

export const MemberCandidatePicker = ({
    value,
    onChange,
    name,
    label = 'Участник',
}: {
    value: string;
    onChange: (value: string) => void;
    name?: string;
    label?: string;
}) => {
    const [candidates, setCandidates] = useState<ProjectMemberCandidateDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        const query = value.trim();
        if (query.length < 2) {
            setCandidates([]);
            setLoading(false);
            setFailed(false);
            return;
        }
        let current = true;
        setLoading(true);
        const timer = window.setTimeout(() => {
            void projectsApi.memberCandidates(query).then(
                (result) => {
                    if (!current) return;
                    setCandidates(result);
                    setFailed(false);
                    setLoading(false);
                },
                () => {
                    if (!current) return;
                    setCandidates([]);
                    setFailed(true);
                    setLoading(false);
                },
            );
        }, 250);
        return () => {
            current = false;
            window.clearTimeout(timer);
        };
    }, [value]);
    return (
        <div className="member-candidate-picker">
            {name && <input type="hidden" name={name} value={value} />}
            <label>
                <span>{label}</span>
                <input
                    type="search"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder="Имя или корпоративная почта"
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-expanded={candidates.length > 0}
                />
            </label>
            {value && (
                <button
                    type="button"
                    className="member-candidate-clear"
                    aria-label="Очистить поиск участника"
                    onClick={() => onChange('')}
                >
                    ×
                </button>
            )}
            {(loading || failed || candidates.length > 0) && (
                <div className="member-candidate-results" role="listbox" aria-label="Найденные пользователи">
                    {loading && <p>Ищем…</p>}
                    {failed && <p>Не удалось выполнить поиск.</p>}
                    {!loading && !failed && candidates.length === 0 && <p>Пользователи не найдены.</p>}
                    {candidates.map((candidate) => {
                        const identifier = candidate.email || candidate.username || '';
                        return (
                            <button
                                type="button"
                                role="option"
                                aria-selected={value === identifier}
                                key={candidate.userId}
                                onClick={() => {
                                    onChange(identifier);
                                    setCandidates([]);
                                }}
                            >
                                <strong>{candidate.displayName || candidate.username || candidate.email}</strong>
                                <small>{[candidate.username, candidate.email].filter(Boolean).join(' · ')}</small>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export const MemberActionsMenu = ({ label, onRemove }: { label: string; onRemove: () => void }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const { popoverRef, style } = useAnchoredPopover(open, triggerRef, 168);
    const closeAndFocusTrigger = useCallback(() => {
        setOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
    }, []);
    const closeAndMoveFocus = useCallback(
        (backward: boolean) => {
            const trigger = triggerRef.current;
            if (!trigger) return;
            setOpen(false);
            requestAnimationFrame(() => focusRelativeToTrigger(trigger, popoverRef.current, backward));
        },
        [popoverRef],
    );
    useEffect(() => {
        if (!open) return;
        const frame = requestAnimationFrame(() => {
            popoverRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
        });
        return () => cancelAnimationFrame(frame);
    }, [open, popoverRef]);
    useEffect(() => {
        if (!open) return;
        const close = (event: MouseEvent | KeyboardEvent) => {
            if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
            if (
                event instanceof MouseEvent &&
                (ref.current?.contains(event.target as Node) || popoverRef.current?.contains(event.target as Node))
            )
                return;
            if (event instanceof KeyboardEvent) closeAndFocusTrigger();
            else setOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', close);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', close);
        };
    }, [closeAndFocusTrigger, open, popoverRef]);
    return (
        <div className="ps-member-menu" ref={ref}>
            <button
                ref={triggerRef}
                type="button"
                className="ps-icon-button"
                aria-label={`Действия участника ${label}`}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
            >
                ⋯
            </button>
            {open &&
                createPortal(
                    <div
                        className="card-dropdown ps-member-actions-popover"
                        role="menu"
                        ref={popoverRef}
                        style={style}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                event.preventDefault();
                                event.stopPropagation();
                                closeAndFocusTrigger();
                            }
                            if (event.key === 'Tab') {
                                event.preventDefault();
                                event.stopPropagation();
                                closeAndMoveFocus(event.shiftKey);
                            }
                        }}
                    >
                        <button
                            type="button"
                            className="danger-menu-item"
                            role="menuitem"
                            onClick={() => {
                                setOpen(false);
                                onRemove();
                            }}
                        >
                            Удалить из проекта
                        </button>
                    </div>,
                    document.body,
                )}
        </div>
    );
};
