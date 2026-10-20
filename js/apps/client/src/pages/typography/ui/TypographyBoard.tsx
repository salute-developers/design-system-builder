import type { CSSProperties } from 'react';

import {
    formatNumber,
    groupStyles,
    sampleText,
    styleKey,
    styleLabel,
    type TypographyFamily,
    type TypographyStyle,
} from '../../../modules/typographyTokens';

interface TypographyBoardProps {
    title: string;
    styles: TypographyStyle[];
    families: TypographyFamily[];
    selectedKey: string;
    onSelect: (key: string) => void;
}

/** Высоты строк заголовков из `typographyScaleCanvas` прототипа: строка, образец, сдвиг образца. */
const HEADER_LAYOUT: Record<string, [number, number, number]> = {
    h1: [70, 70, 0],
    h2: [56, 54, 2],
    h3: [50, 48, 2],
    h4: [49, 46, 2],
    h5: [49, 46, 2],
    h6: [49, 46, 2],
};

/** Доля размера шрифта, которую занимают буквы образца от верха прописных до низа строчных. */
const INK_RATIO = 0.75;
const INK_PADDING = 8;

/**
 * Высоты строки и образца прототипа. Если буквы образца в них не помещаются (стиль увеличили), строка и образец
 * растут на недостающую высоту: прототип рассчитан на значения темы по умолчанию и обрезает крупный образец.
 */
export const rowLayout = (style: TypographyStyle): [number, number, number] => {
    const fallback = Math.min(Math.max(style.lineHeightPx + 20, 48), 76);
    const [row, sample, offset]: [number, number, number] =
        style.group === 'display'
            ? [76, style.size === 's' ? 63 : 76, 0]
            : (style.group === 'header' && HEADER_LAYOUT[style.size]) || [fallback, fallback, 0];
    const grow = Math.max(0, Math.ceil(style.sizePx * INK_RATIO) + INK_PADDING - sample);
    return [row + grow, sample + grow, offset];
};

/** Шрифт стиля для образца: имя шрифта семейства дизайн-системы. */
export const fontNameOf = (families: TypographyFamily[], family: string) =>
    families.find((item) => item.name === family)?.fontName || family;

/**
 * Образец текста стилем: семейство, размер, вес начертания и трекинг. Образец — одна строка, поэтому высота строки
 * не меньше размера: при меньшей браузер выталкивает буквы за строку, и их срезает граница образца.
 */
export const sampleStyle = (families: TypographyFamily[], style: TypographyStyle): CSSProperties => ({
    fontFamily: `'${fontNameOf(families, style.fontFamily)}', sans-serif`,
    fontSize: `${style.sizePx}px`,
    lineHeight: `${Math.max(style.lineHeightPx, style.sizePx)}px`,
    fontWeight: style.variants.normal?.weight ?? 400,
    letterSpacing: `${style.letterSpacingEm}em`,
});

/** Борд-шкала стилей экрана по `typographyScaleCanvas` прототипа. */
export const TypographyBoard = ({ title, styles, families, selectedKey, onSelect }: TypographyBoardProps) => (
    <div className="token-canvas typography-canvas">
        <div className="typography-board">
            <header className="typography-board-header">
                <div>
                    <strong>{title}</strong>
                    <span>{styles.length} стилей</span>
                </div>
                <span>Размер / Высота строки</span>
            </header>
            {groupStyles(styles).map((group) => (
                <section key={group.id} className="typography-canvas-group">
                    <h3>
                        {group.label} <span>· {group.styles.length}</span>
                    </h3>
                    <div className="typography-canvas-list">
                        {group.styles.map((style) => {
                            const [row, sample, offset] = rowLayout(style);
                            const weights = (['normal', 'medium', 'bold'] as const)
                                .map((variant) => style.variants[variant]?.weight)
                                .filter((weight) => weight !== undefined)
                                .join('·');
                            const size = formatNumber(style.sizePx);
                            const lineHeight = formatNumber(style.lineHeightPx);
                            return (
                                <button
                                    key={styleKey(style)}
                                    type="button"
                                    className={`typography-canvas-row ${styleKey(style) === selectedKey ? 'is-selected' : ''}`}
                                    style={
                                        {
                                            '--typography-row-height': `${row}px`,
                                            '--typography-sample-height': `${sample}px`,
                                            '--typography-sample-offset': `${offset}px`,
                                        } as CSSProperties
                                    }
                                    aria-label={`${styleLabel(style)}, ${size} px, ${lineHeight} px line`}
                                    onClick={() => onSelect(styleKey(style))}
                                >
                                    <span className="typography-canvas-meta">
                                        <strong>{styleLabel(style)}</strong>
                                        <small>{fontNameOf(families, style.fontFamily)}</small>
                                    </span>
                                    <span className="typography-canvas-sample">
                                        <span
                                            className="typography-visible-sample"
                                            style={sampleStyle(families, style)}
                                        >
                                            {sampleText(style.group)}
                                        </span>
                                    </span>
                                    <span className="typography-canvas-value">
                                        <strong>{size} px</strong>
                                        <small>строка {lineHeight} px</small>
                                        <small>W {weights}</small>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    </div>
);
