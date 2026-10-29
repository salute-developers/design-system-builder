import { useMemo, useState } from 'react';

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
    return (
        <div className="cp-library cp-source-library">
            <div className="cp-library-search">
                {/* Поле как поиск раздела «Палитра» и дерева токенов (`.source-palette-family-search`). */}
                <label className="source-palette-family-search cp-library-search-field">
                    <span aria-hidden="true">⌕</span>
                    <input
                        value={query}
                        placeholder="Найти"
                        aria-label="Найти цвет в библиотеке"
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </label>
            </div>
            <div className="cp-library-list">
                {visible.map(({ ramp, name, steps }) => (
                    <section key={`${ramp.type}.${ramp.shade}`} className="cp-library-group">
                        <h3>{name.replace(/\s+/g, '-').toLowerCase()}</h3>
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
                {visible.length === 0 && <p className="cp-library-empty">В Palette пока нет доступных палитр.</p>}
            </div>
        </div>
    );
};
