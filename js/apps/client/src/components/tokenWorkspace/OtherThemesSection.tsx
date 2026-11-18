import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import type { EditorContextKey, TenantTokenValueDto } from '../../api/editorContracts';
import { tokenRepository } from '../../api/tokenRepository';
import { themesApi } from '../../modules/themes/data/themesApi';
import { normalizeThemeName } from '../../modules/themes/domain/themeProfiles';
import { useLoad } from '../../shared/data/useLoad';
import {
    THEME_SEARCH_THRESHOLD,
    THEME_SWITCH_BLOCKED,
    switchTheme,
    themesCacheKey,
} from '../BuilderShell/ThemeSwitcher';
import { TreeHeader, usePersistedOpen } from './TokenWorkspace';

const OPEN_KEY = 'dsb.inspector.other-themes.open';

/**
 * Блок инспектора «В других темах»: значения выбранного токена во всех остальных темах дизайн-системы, только для
 * чтения. Значения грузятся одним запросом при раскрытии. Отметки отличия нет: разница видна по самим значениям.
 */
export const OtherThemesSection = ({
    context,
    tokenIds,
    addressTokenId,
    columns,
    describe,
}: {
    context: EditorContextKey;
    /** Токены, значения которых нужны для строк; для типографики — все начертания стиля. */
    tokenIds: string[];
    /** Токен, который открывается в выбранной теме. */
    addressTokenId: string;
    columns: string[];
    /** Ячейки значений строки темы, по одной на колонку. */
    describe: (values: TenantTokenValueDto[]) => ReactNode[];
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [open, setOpen] = usePersistedOpen(OPEN_KEY);
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string>();
    const [switchError, setSwitchError] = useState<string>();
    const [attempt, setAttempt] = useState(0);
    const [data, setData] = useState<{ key: string; byTenant: Map<string, TenantTokenValueDto[]> }>();
    const themes = useLoad(
        (signal) => themesApi.list(context.projectId, context.designSystemId, signal, context.versionId),
        [context.projectId, context.designSystemId, context.versionId],
        themesCacheKey(context),
    );
    const others = (themes.data?.length ?? 1) - 1;
    const requestKey = `${context.designSystemId}:${context.versionId ?? ''}:${tokenIds.join(',')}`;

    useEffect(() => {
        if (!open || !tokenIds.length) return;
        const controller = new AbortController();
        setError(undefined);
        tokenRepository.loadValuesByTenant(context, tokenIds, controller.signal).then(
            (byTenant) => setData({ key: requestKey, byTenant }),
            () => {
                if (!controller.signal.aborted) setError('Не удалось загрузить значения других тем.');
            },
        );
        return () => controller.abort();
        // Запрос зависит от набора токенов и границы версии, а не от объекта контекста.
    }, [open, requestKey, attempt]);

    const rows = useMemo(() => {
        if (data?.key !== requestKey || !themes.data) return null;
        // Строка пуста, пока поиск закрыт: «Закрыть поиск» и Escape очищают её.
        const needle = normalizeThemeName(query).toLocaleLowerCase('ru-RU');
        // Названия и порядок — из списка тем: в значениях есть только идентификатор темы.
        return [...themes.data]
            .filter((theme) => theme.id !== context.tenantId)
            .sort((left, right) => left.name.localeCompare(right.name, 'ru'))
            .filter((theme) => !needle || theme.name.toLocaleLowerCase('ru-RU').includes(needle))
            .map((theme) => ({
                item: { tenantId: theme.id, tenantName: theme.name },
                cells: describe(data.byTenant.get(theme.id) ?? []),
            }));
    }, [context.tenantId, data, describe, query, requestKey, themes.data]);

    if (others < 1) return null;

    const openTheme = async (tenantId: string) => {
        const search = new URLSearchParams(location.search);
        search.set('tokenId', addressTokenId);
        setSwitchError(undefined);
        if (!(await switchTheme(context, navigate, location.pathname, search.toString(), tenantId))) {
            setSwitchError(THEME_SWITCH_BLOCKED);
        }
    };

    return (
        <section
            className="other-themes tw-section"
            style={{ '--other-themes-columns': columns.length } as CSSProperties}
        >
            <button
                type="button"
                className="other-themes-toggle"
                aria-expanded={open}
                onClick={() => {
                    setOpen(!open);
                    // Свёрнутый блок забывает поиск: при раскрытии поле не должно открыться со старой строкой.
                    setSearching(false);
                    setQuery('');
                }}
            >
                <span>В других темах · {others}</span>
                <span className={`other-themes-chevron ${open ? 'is-open' : ''}`} aria-hidden="true" />
            </button>
            {open && (
                <div className="other-themes-body">
                    {others > THEME_SEARCH_THRESHOLD && (
                        <TreeHeader
                            className="other-themes-header"
                            title="Темы"
                            searching={searching}
                            query={query}
                            placeholder="Найти тему"
                            searchLabel="Найти тему в других темах"
                            onQuery={setQuery}
                            onSearchOpen={setSearching}
                        />
                    )}
                    {switchError && (
                        <p className="other-themes-note" role="alert">
                            {switchError}
                        </p>
                    )}
                    {error ? (
                        <p className="other-themes-note" role="alert">
                            {error}{' '}
                            <button type="button" onClick={() => setAttempt(attempt + 1)}>
                                Повторить
                            </button>
                        </p>
                    ) : !rows ? (
                        <p className="other-themes-note">Загружаем значения…</p>
                    ) : (
                        <div className="other-themes-table" role="table" aria-label="Значения в других темах">
                            <div className="other-themes-row is-head" role="row">
                                <span role="columnheader">Тема</span>
                                {columns.map((column) => (
                                    <span role="columnheader" key={column}>
                                        {column}
                                    </span>
                                ))}
                            </div>
                            {rows.map(({ item, cells }) => (
                                <button
                                    type="button"
                                    role="row"
                                    className="other-themes-row"
                                    key={item.tenantId}
                                    title={`Открыть тему ${item.tenantName ?? ''}`}
                                    onClick={() => void openTheme(item.tenantId)}
                                >
                                    <span role="cell" className="other-themes-name">
                                        {item.tenantName}
                                    </span>
                                    {cells.map((cell, index) => (
                                        <span role="cell" key={index}>
                                            {cell}
                                        </span>
                                    ))}
                                </button>
                            ))}
                            {!rows.length && <p className="other-themes-note">Тем не найдено</p>}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
};

/** Первое значение web нужного режима. */
export const webValue = (values: TenantTokenValueDto[], tokenId: string, mode: 'light' | 'dark' | null) =>
    values.find((value) => value.tokenId === tokenId && value.platform === 'web' && value.mode === mode)?.value;

/** Пиксели из CSS-длины `rem` или `px`; `null` для другой формы. */
export const cssPx = (value: unknown): number | null => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return null;
    const match = /^(-?[\d.]+)(rem|px)$/.exec(value.trim());
    if (!match) return null;
    const number = Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
    return Math.round(number * 100) / 100;
};
