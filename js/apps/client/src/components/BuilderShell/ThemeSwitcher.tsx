import type { KeyboardEvent } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import type { EditorContextKey } from '../../api/editorContracts';
import { waitForDraftAutosaveIdle } from '../../api/draftAutosaveActivity';
import { themesApi } from '../../modules/themes/data/themesApi';
import type { ThemeProfile, ThemeTenant } from '../../modules/themes/domain/theme';
import { normalizeThemeName, themeProfileLabels } from '../../modules/themes/domain/themeProfiles';
import { useLoad } from '../../shared/data/useLoad';
import { useAnchoredPopover } from '../Overlay/Overlay';

/** Больше стольких тем список получает поиск по названию. */
export const THEME_SEARCH_THRESHOLD = 7;

/** Путь той же секции в другой теме: меняется только сегмент `themes/:tenantId`. */
export const themeSwitchPath = (pathname: string, tenantId: string, nextTenantId: string) =>
    pathname.replace(`/themes/${tenantId}`, `/themes/${nextTenantId}`);

/** Ключ кэша списка тем: у опубликованной версии свой список. */
export const themesCacheKey = ({ projectId, designSystemId, versionId }: EditorContextKey) =>
    versionId ? `themes:${projectId}:${designSystemId}:${versionId}` : `themes:${projectId}:${designSystemId}`;

export const THEME_SWITCH_BLOCKED = 'Есть несохранённые изменения. Дождитесь сохранения и повторите выбор темы.';

/**
 * Переход редактора в ту же секцию другой темы с параметрами адреса [search]. Незавершённое автосохранение прежней
 * темы дожидается конца, как при смене версии; если оно не закончилось, перехода нет и возвращается `false`.
 */
export const switchTheme = async (
    context: EditorContextKey,
    navigate: (to: { pathname: string; search: string }) => void,
    pathname: string,
    search: string,
    nextTenantId: string,
) => {
    try {
        if (!context.versionId) await waitForDraftAutosaveIdle(context, 10_000);
    } catch {
        return false;
    }
    navigate({ pathname: themeSwitchPath(pathname, context.tenantId, nextTenantId), search });
    return true;
};

const matches = (theme: ThemeTenant, query: string) =>
    theme.name.toLocaleLowerCase('ru-RU').includes(normalizeThemeName(query).toLocaleLowerCase('ru-RU'));

const ThemeSwatch = ({ theme }: { theme: ThemeTenant }) => (
    <span className="theme-switcher-swatch" aria-hidden="true">
        <span style={{ background: theme.preview.surfaceLight }}>
            <i style={{ background: theme.preview.accentLight }} />
        </span>
        <span style={{ background: theme.preview.surfaceDark }}>
            <i style={{ background: theme.preview.accentDark }} />
        </span>
    </span>
);

/**
 * Крошка «Тема» шапки редактора: список тем дизайн-системы. Выбор открывает ту же секцию в другой теме и переносит
 * параметры адреса (`versionId`, `tokenId`), поэтому выбранный токен остаётся выбранным.
 */
export const ThemeSwitcher = ({
    context,
    currentName,
    canCreate,
}: {
    context: EditorContextKey;
    currentName: string;
    canCreate: boolean;
}) => {
    const { projectId, designSystemId, tenantId } = context;
    const navigate = useNavigate();
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const [error, setError] = useState<string>();
    const rootRef = useRef<HTMLSpanElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const { popoverRef, style } = useAnchoredPopover(open, triggerRef, 280);
    // В опубликованной версии список — темы этой версии: в черновике могут быть темы, которых в ней нет.
    const themes = useLoad(
        (signal) => themesApi.list(projectId, designSystemId, signal, context.versionId),
        [projectId, designSystemId, context.versionId],
        themesCacheKey(context),
    );
    const all = themes.data ?? [];
    const searchable = all.length > THEME_SEARCH_THRESHOLD;
    const shown = useMemo(
        () => (searchable && query ? all.filter((theme) => matches(theme, query)) : all),
        [all, query, searchable],
    );

    const close = (focusTrigger: boolean) => {
        setOpen(false);
        setQuery('');
        if (focusTrigger) requestAnimationFrame(() => triggerRef.current?.focus());
    };

    // Фокус ставится один раз после открытия, когда список тем загружен и уже видим: скрытый элемент фокус не
    // принимает, а `useAnchoredPopover` показывает панель только после расчёта положения. Дальше фокус ведут стрелки.
    const visible = style.visibility === 'visible';
    const focusedOnOpen = useRef(false);
    useLayoutEffect(() => {
        if (!open) {
            focusedOnOpen.current = false;
            return;
        }
        if (focusedOnOpen.current || !themes.data || !visible) return;
        focusedOnOpen.current = true;
        const current = Math.max(
            0,
            shown.findIndex((theme) => theme.id === tenantId),
        );
        setActive(current);
        if (searchable) searchRef.current?.focus();
        else listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[current]?.focus();
    }, [open, themes.data, visible]);

    useEffect(() => setActive(0), [query]);

    useEffect(() => {
        if (!open) return;
        const outside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
            close(false);
        };
        document.addEventListener('mousedown', outside);
        return () => document.removeEventListener('mousedown', outside);
    }, [open, popoverRef]);

    useEffect(() => {
        if (!open || searchable) return;
        listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[active]?.focus();
    }, [active, open, searchable]);

    const choose = async (theme: ThemeTenant) => {
        close(true);
        if (theme.id === tenantId) return;
        setError(undefined);
        if (!(await switchTheme(context, navigate, location.pathname, location.search, theme.id))) {
            setError(THEME_SWITCH_BLOCKED);
        }
    };

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close(true);
            return;
        }
        if (event.key === 'Tab') {
            close(false);
            return;
        }
        if (!shown.length) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            setActive((current) => (current + step + shown.length) % shown.length);
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            const theme = shown[active];
            if (theme) void choose(theme);
        }
    };

    const listId = `theme-switcher-${tenantId}`;
    const createTo = `/projects/${projectId}/design-systems/${designSystemId}/themes/new?${new URLSearchParams({
        from: tenantId,
    })}`;

    return (
        // События из списка в портале всплывают сюда же: клавиши работают, даже пока фокус ещё на кнопке крошки.
        <span className="theme-switcher" ref={rootRef} onKeyDown={open ? onKeyDown : undefined}>
            <button
                ref={triggerRef}
                type="button"
                className="theme-switcher-trigger"
                aria-label={`Тема ${currentName}. Переключить тему`}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listId : undefined}
                onClick={() => (open ? close(false) : setOpen(true))}
                onKeyDown={(event) => {
                    if (open || event.key !== 'ArrowDown') return;
                    event.preventDefault();
                    setOpen(true);
                }}
            >
                <span>{currentName}</span>
                <span className="theme-switcher-chevron" aria-hidden="true" />
            </button>
            {error && (
                <span className="theme-switcher-error" role="alert">
                    {error}
                </span>
            )}
            {open &&
                createPortal(
                    <div className="theme-switcher-popover" ref={popoverRef} style={style}>
                        {searchable && (
                            <input
                                ref={searchRef}
                                className="theme-switcher-search"
                                type="search"
                                placeholder="Найти тему"
                                aria-label="Найти тему"
                                aria-controls={listId}
                                aria-activedescendant={shown[active] ? `${listId}-${shown[active].id}` : undefined}
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                            />
                        )}
                        <div className="theme-switcher-list" role="listbox" id={listId} aria-label="Темы" ref={listRef}>
                            {!themes.data && !themes.error && <p className="theme-switcher-note">Загружаем темы…</p>}
                            {themes.error ? <p className="theme-switcher-note">Не удалось загрузить темы</p> : null}
                            {themes.data && !shown.length && <p className="theme-switcher-note">Тем не найдено</p>}
                            {shown.map((theme, index) => (
                                <button
                                    key={theme.id}
                                    id={`${listId}-${theme.id}`}
                                    type="button"
                                    role="option"
                                    tabIndex={-1}
                                    aria-selected={theme.id === tenantId}
                                    className={`theme-switcher-option ${index === active ? 'is-active' : ''}`}
                                    onMouseEnter={() => setActive(index)}
                                    onClick={() => void choose(theme)}
                                >
                                    <ThemeSwatch theme={theme} />
                                    <span className="theme-switcher-name">{theme.name}</span>
                                    <span className="theme-switcher-profile">
                                        {themeProfileLabels[theme.colorConfig.profile as ThemeProfile] ?? 'Custom'}
                                    </span>
                                </button>
                            ))}
                        </div>
                        {canCreate && (
                            <Link className="theme-switcher-create" to={createTo} onClick={() => close(false)}>
                                Создать тему
                            </Link>
                        )}
                    </div>,
                    document.body,
                )}
        </span>
    );
};
