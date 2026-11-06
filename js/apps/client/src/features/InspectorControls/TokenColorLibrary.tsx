import { useEffect, useMemo, useRef, useState } from 'react';

import { alphaSwatchStyle } from '../../pages/colors/ui/swatch';
import { TyGlyph } from '../../pages/typography/ui/TyGlyph';

import type { ColorTokenOption } from './types';

interface TokenColorLibraryProps {
    options: ColorTokenOption[];
    value?: string;
    onPick: (option: ColorTokenOption) => void;
}

const PREFERENCES_KEY = 'sdds-color-library-preferences';
const SUBGROUP_ORDER = ['General', 'Accent', 'Status'];
/** Группы в порядке библиотеки прототипа; остальные — после них. */
const GROUP_ORDER = ['Text', 'Surface', 'Background', 'Outline', 'Overlay', 'Data'];

interface Preferences {
    subthemes: boolean;
    grid: boolean;
}

const readPreferences = (): Preferences => {
    try {
        const stored = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}');
        return { subthemes: stored.subthemes === true, grid: stored.grid === true };
    } catch {
        return { subthemes: false, grid: false };
    }
};

const writePreferences = (preferences: Preferences) => {
    try {
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
        // Хранилище недоступно: вид библиотеки просто не запомнится.
    }
};

/** Группы и подгруппы токенов в порядке прототипа: группы по первому появлению, подгруппы General, Accent, Status. */
const groupOptions = (options: ColorTokenOption[]) => {
    const groups = new Map<string, Map<string, ColorTokenOption[]>>();
    options.forEach((option) => {
        const subgroups = groups.get(option.group) ?? new Map<string, ColorTokenOption[]>();
        groups.set(option.group, subgroups);
        subgroups.set(option.subgroup, [...(subgroups.get(option.subgroup) ?? []), option]);
    });
    const rank = (name: string) =>
        SUBGROUP_ORDER.includes(name) ? SUBGROUP_ORDER.indexOf(name) : SUBGROUP_ORDER.length;
    const groupRank = (name: string) => (GROUP_ORDER.includes(name) ? GROUP_ORDER.indexOf(name) : GROUP_ORDER.length);
    return [...groups]
        .sort(([a], [b]) => groupRank(a) - groupRank(b))
        .map(([group, subgroups]) => ({
            group,
            subgroups: [...subgroups].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b)),
        }));
};

/**
 * Вкладка «Библиотека» пикера цвета в инспекторе (`componentColorLibraryView` прототипа): токены темы по группам
 * и подгруппам, поиск, «Токены сабтем», сетка или список. Флажок и вид запоминаются в браузере.
 */
export const TokenColorLibrary = ({ options, value, onPick }: TokenColorLibraryProps) => {
    const [query, setQuery] = useState('');
    const [preferences, setPreferences] = useState(readPreferences);
    const list = useRef<HTMLDivElement>(null);
    // Выбранный токен виден сразу при открытии библиотеки.
    useEffect(() => {
        list.current?.querySelector<HTMLElement>('.cp-preset.is-active')?.scrollIntoView?.({ block: 'center' });
    }, []);
    const update = (patch: Partial<Preferences>) =>
        setPreferences((current) => {
            const next = { ...current, ...patch };
            writePreferences(next);
            return next;
        });
    const groups = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return groupOptions(
            options.filter(
                (option) =>
                    (preferences.subthemes || option.subtheme === 'default') &&
                    (!needle || `${option.label} ${option.group} ${option.subgroup}`.toLowerCase().includes(needle)),
            ),
        );
    }, [options, query, preferences.subthemes]);

    return (
        <div className={`cp-library cp-source-library cp-component-library ${preferences.grid ? 'is-grid' : ''}`}>
            <div className="cp-library-search">
                <span aria-hidden="true">⌕</span>
                <input
                    aria-label="Найти токен цвета"
                    placeholder="Найти"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />
            </div>
            <div className="cp-library-toolbar">
                <button
                    type="button"
                    role="checkbox"
                    aria-checked={preferences.subthemes}
                    title="Показывать токены OnDark, OnLight и Inverse"
                    onClick={() => update({ subthemes: !preferences.subthemes })}
                >
                    <span className="cp-library-check">{preferences.subthemes && <TyGlyph name="check" />}</span>
                    Токены сабтем
                </button>
                <button
                    type="button"
                    aria-label={preferences.grid ? 'Показать списком' : 'Показать сеткой'}
                    title={preferences.grid ? 'Показать списком' : 'Показать сеткой'}
                    onClick={() => update({ grid: !preferences.grid })}
                >
                    <TyGlyph name={preferences.grid ? 'menu' : 'swatch-grid'} />
                </button>
            </div>
            <div ref={list} className="cp-library-list">
                {groups.map(({ group, subgroups }) => (
                    <section key={group} className="cp-library-group">
                        <h3>{group}</h3>
                        {subgroups.map(([subgroup, items]) => (
                            <div key={subgroup} className="cp-library-subgroup">
                                <h4>{subgroup}</h4>
                                <div className="cp-library-swatches">
                                    {items.map((option) => {
                                        const active = option.value === value;
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                className={`cp-preset ${preferences.grid ? 'alpha-swatch' : ''} ${active ? 'is-active' : ''}`}
                                                style={preferences.grid ? alphaSwatchStyle(option.color) : undefined}
                                                aria-pressed={active}
                                                title={`${option.label} · ${group} / ${subgroup}`}
                                                onClick={() => onPick(option)}
                                            >
                                                {!preferences.grid && (
                                                    <i
                                                        className="alpha-swatch"
                                                        style={alphaSwatchStyle(option.color)}
                                                    />
                                                )}
                                                {!preferences.grid && <span>{option.label}</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </section>
                ))}
                {!groups.length && <p className="cp-library-empty">Токены не найдены</p>}
            </div>
        </div>
    );
};
