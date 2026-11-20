import type { CSSProperties } from 'react';

import {
    formatNumber,
    sampleText,
    screenGroups,
    styleKey,
    styleLabel,
    styleTitle,
    styleVariant,
    TYPOGRAPHY_VARIANTS,
    type TypographyFamily,
    type TypographyStyle,
    type TypographyVariant,
} from '../../../modules/typographyTokens';
import { UNCONFIGURED_TEXT } from './TypographyTree';

interface TypographyBoardProps {
    styles: TypographyStyle[];
    families: TypographyFamily[];
    selectedKey: string;
    /** Открытое начертание: каждое начертание стиля — своя строка борда. */
    variant: TypographyVariant;
    onSelect: (key: string, variant: TypographyVariant) => void;
}

/** Минимальная высота строки борда по Figma. */
const MIN_ROW_HEIGHT = 100;
/** Вертикальные отступы карточки образца. */
const SAMPLE_PADDING = 24;

/** Высота строки борда: не меньше 100 px, растёт вместе с высотой строки стиля. */
export const rowHeight = (style: TypographyStyle) =>
    Math.max(MIN_ROW_HEIGHT, Math.ceil(style.lineHeightPx) + SAMPLE_PADDING);

/** Шрифт стиля для образца: имя шрифта семейства дизайн-системы. */
export const fontNameOf = (families: TypographyFamily[], family: string) =>
    families.find((item) => item.name === family)?.fontName || family;

/**
 * Образец текста стилем: семейство, размер, высота строки, вес выбранного начертания и трекинг. Образец — одна
 * строка высотой в высоту строки стиля, обрезается по ней: уменьшение высоты строки видно на борде.
 */
export const sampleStyle = (
    families: TypographyFamily[],
    style: TypographyStyle,
    variant: TypographyVariant = 'normal',
): CSSProperties => ({
    fontFamily: `'${fontNameOf(families, style.fontFamily)}', sans-serif`,
    fontSize: `${style.sizePx}px`,
    lineHeight: `${style.lineHeightPx}px`,
    height: `${style.lineHeightPx}px`,
    fontWeight: style.variants[styleVariant(style, variant)]?.weight ?? 400,
    letterSpacing: `${style.letterSpacingEm}em`,
});

/** Борд стилей экрана по группам: строка — карточка метаданных 114 px и карточка образца. */
export const TypographyBoard = ({ styles, families, selectedKey, variant, onSelect }: TypographyBoardProps) => (
    <div className="typography-board tw-board">
        {screenGroups(styles).map((group) => (
            <section key={group.id} className="typography-board-group tw-board-section">
                <header className="tw-board-heading">
                    <h3 className="typography-board-heading tw-board-title">
                        {group.label}
                        {group.styles.length > 0 && ` · ${group.styles.length}`}
                    </h3>
                </header>
                {group.styles.length ? (
                    <div className="typography-board-list tw-board-rows">
                        {group.styles.flatMap((style) =>
                            TYPOGRAPHY_VARIANTS.filter(({ id }) => style.variants[id]).map(({ id, label }) => {
                                const size = formatNumber(style.sizePx);
                                const lineHeight = formatNumber(style.lineHeightPx);
                                const selected = styleKey(style) === selectedKey && id === variant;
                                return (
                                    <button
                                        key={`${styleKey(style)}.${id}`}
                                        type="button"
                                        className={`typography-board-row ${selected ? 'is-selected' : ''}`}
                                        style={{ minHeight: `${rowHeight(style)}px` }}
                                        aria-label={`${styleTitle(style)} ${label}, ${size} px, ${lineHeight} px line`}
                                        aria-pressed={selected}
                                        onClick={() => onSelect(styleKey(style), id)}
                                    >
                                        <span className="typography-board-meta tw-meta">
                                            <strong>
                                                {styleLabel(style)} {label}
                                            </strong>
                                            <span>{size} px</span>
                                            <span>строка {lineHeight} px</span>
                                            <span>W {style.variants[id]?.weight}</span>
                                            <span>{fontNameOf(families, style.fontFamily)}</span>
                                        </span>
                                        <span className="typography-board-sample">
                                            {/* `data-preview`: образец набирается шрифтом стиля, а не Inter оболочки. */}
                                            <span
                                                className="typography-visible-sample"
                                                data-preview
                                                style={sampleStyle(families, style, id)}
                                            >
                                                {sampleText(style.group)}
                                            </span>
                                        </span>
                                    </button>
                                );
                            }),
                        )}
                    </div>
                ) : (
                    <p className="typography-unconfigured is-board">{UNCONFIGURED_TEXT}</p>
                )}
            </section>
        ))}
    </div>
);

/**
 * Загрузка борда `Foundation/WorkspaceState · Loading · Typography`: скелетоны строк — карточка метаданных и
 * образец. Общий `PanelSkeleton` рисует ряды плиток «Цветов» и «Размеров», строк у него нет.
 */
export const TypographyBoardSkeleton = () => (
    <div className="tw-skeleton typography-board-skeleton" aria-hidden="true" data-skeleton="workspace">
        {Array.from({ length: 12 }, (_, row) => (
            <div className="tw-skeleton-tiles" key={row}>
                <span className="tw-skeleton-tile typography-skeleton-meta" />
                <span className="tw-skeleton-tile typography-skeleton-sample" />
            </div>
        ))}
    </div>
);
