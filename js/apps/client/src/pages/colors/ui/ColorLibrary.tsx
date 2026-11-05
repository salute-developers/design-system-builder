import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SearchOutline } from '@salutejs/sdds-icons/16';

import { SEARCH_EMPTY_TEXT } from '../../../components/tokenWorkspace';

import {
    groupRampName,
    resolveStepInGroup,
    resolveTokenGroupId,
    type PaletteType,
    type ThemePalette,
} from '../../../modules/palette';

export interface LibraryPick {
    type: PaletteType;
    shade: string;
    step: number;
    hex: string;
}

interface LibraryProps {
    palette: ThemePalette | null;
    tokenName: string;
    active: { type: string; shade: string; step: number } | null;
    onPick: (pick: LibraryPick) => void;
}

/** Вкладка «Библиотека» по `colorPickerLibraryView`: растяжки палитры темы со ступенями группы токена. */
export const ColorLibrary = ({ palette, tokenName, active, onPick }: LibraryProps) => {
    const [query, setQuery] = useState('');
    const rows = useMemo(() => {
        if (!palette) return [];
        const groupId = resolveTokenGroupId(palette, tokenName);
        return palette.template.map((ramp) => ({
            ramp,
            name: groupRampName(palette, groupId, ramp),
            // Как в прототипе (`SDDS_ADDITIONAL_PALETTE.steps`): от тёмных ступеней к светлым.
            steps: [...ramp.steps]
                .sort((a, b) => b.step - a.step)
                .map(({ step }) => ({
                    step,
                    hex: (groupId ? resolveStepInGroup(palette, groupId, { ...ramp, step }) : undefined) ?? null,
                })),
        }));
    }, [palette, tokenName]);
    const needle = query.trim().toLowerCase();
    const visible = rows.filter((row) => !needle || `${row.name} ${row.ramp.shade}`.toLowerCase().includes(needle));
    // Выбранная ступень видна при открытии вкладки: список прокручивается к ней, окно и панель — нет.
    const list = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const container = list.current;
        const item = container?.querySelector<HTMLElement>('.cp-preset.is-active');
        if (!container || !item) return;
        const top = item.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
        if (top < container.scrollTop || top + item.offsetHeight > container.scrollTop + container.clientHeight)
            container.scrollTop = Math.max(0, top - (container.clientHeight - item.offsetHeight) / 2);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- только при открытии и смене палитры
    }, [rows]);
    return (
        <div className="cp-library">
            <div className="cp-library-search">
                {/* Поле поиска `Builder/SearchField`, как в шапке дерева токенов. */}
                <label className="tw-search-field">
                    <SearchOutline aria-hidden="true" />
                    <input
                        value={query}
                        placeholder="Найти"
                        aria-label="Найти цвет в библиотеке"
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </label>
            </div>
            <div className="cp-library-list" ref={list}>
                {visible.map(({ ramp, name, steps }) => (
                    <section key={`${ramp.type}.${ramp.shade}`} className="cp-library-group">
                        <h3>{name}</h3>
                        <div className="cp-library-swatches">
                            {steps.map(({ step, hex }) =>
                                hex ? (
                                    <button
                                        key={step}
                                        type="button"
                                        className={`cp-preset ${active?.type === ramp.type && active.shade === ramp.shade && active.step === step ? 'is-active' : ''}`}
                                        style={{ background: hex }}
                                        title={`${name} ${step} · ${hex}`}
                                        aria-label={`${name} ${step} ${hex}`}
                                        onClick={() => onPick({ type: ramp.type, shade: ramp.shade, step, hex })}
                                    />
                                ) : (
                                    <span
                                        key={step}
                                        className="cp-preset cp-preset-empty"
                                        title={`${name} ${step}: значение не найдено`}
                                    />
                                ),
                            )}
                        </div>
                    </section>
                ))}
                {visible.length === 0 && (
                    <p className="cp-library-empty">
                        {rows.length ? SEARCH_EMPTY_TEXT : 'В Palette пока нет доступных палитр.'}
                    </p>
                )}
            </div>
        </div>
    );
};
