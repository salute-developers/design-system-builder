import type { CSSProperties, ReactNode } from 'react';

import {
    boxShadow,
    compareTokens,
    groupLabel,
    shadowParts,
    sizeLabel,
    shortName,
    type DimensionToken,
    type ShadowToken,
    type SizeToken,
    type SizeTokenKind,
} from '../../../modules/sizeTokens';
import { rowValue } from './SizeTokenTree';

interface BoardProps {
    kind: SizeTokenKind;
    /** Токены раздела в порядке дерева, без поиска. */
    tokens: SizeToken[];
    selectedId: string | null;
    themeName: string;
    onSelect: (token: SizeToken) => void;
}

/** Подпись вычисляемого радиуса: «L − 2». */
export const derivedLabel = (token: DimensionToken, offsetPx: number) =>
    `${shortName(token)} ${offsetPx < 0 ? '−' : '+'} ${Math.abs(offsetPx)}`;

/** Значение вычисляемого радиуса по текущему значению источника, не меньше 0. */
export const derivedValue = (token: DimensionToken, offsetPx: number) => Math.max(0, (token.valuePx ?? 0) + offsetPx);

/** Заголовок раздела борда: «Семантические радиусы» и пояснение под ним. */
const Section = ({
    title,
    description,
    note,
    testId,
    children,
}: {
    title: string;
    description: string;
    note?: string;
    testId?: string;
    children: ReactNode;
}) => (
    <section className="st-board-section tw-board-section" data-testid={testId}>
        <header className="st-board-section-header tw-board-heading">
            <strong className="tw-board-title">{title}</strong>
            <p className="tw-board-description">{description}</p>
        </header>
        {children}
        {note && <p className="st-board-note tw-board-description">{note}</p>}
    </section>
);

/** Строка `Workspace/DataRow`: карточка метаданных 114 px и плитки 120×100 в одну строку. */
const DataRow = ({ title, caption, children }: { title: string; caption: string; children: ReactNode }) => (
    <div className="st-data-row tw-data-row">
        <div className="st-data-meta tw-meta">
            <strong>{title}</strong>
            <span>{caption}</span>
        </div>
        {children}
    </div>
);

interface TileProps {
    name: string;
    value: string;
    label: string;
    title?: string;
    selected?: boolean;
    preview: ReactNode;
    onClick: () => void;
}

/** Плитка шкалы: подпись «имя значение» в одну строку и превью. */
const Tile = ({ name, value, label, title, selected = false, preview, onClick }: TileProps) => (
    <button
        type="button"
        className={`st-tile tw-tile ${selected ? 'is-selected' : ''}`}
        aria-label={label}
        aria-pressed={selected}
        title={title}
        onClick={onClick}
    >
        <span className="st-tile-caption">
            <span>{name}</span>
            <b>{value}</b>
        </span>
        <span className="st-tile-preview" aria-hidden="true">
            {preview}
        </span>
    </button>
);

/** Контурный квадрат 52×52 со скруглением всех углов; полное скругление — круг. */
const radiusPreview = (px: number | null) => (
    <i
        className="st-radius-preview"
        style={{ '--radius': px === null ? '50%' : `${Math.min(px, 26)}px` } as CSSProperties}
    />
);

/** Два контурных блока с промежутком значения отступа: промежуток больше 80 px показывается как 80. */
const spacingPreview = (px: number) => (
    <i className="st-spacing-preview" style={{ '--gap': `${Math.min(Math.max(px, 0), 80)}px` } as CSSProperties}>
        <b />
        <b />
    </i>
);

const shadowPreview = (token: ShadowToken) => (
    <i className="st-shadow-preview">
        <b style={{ boxShadow: boxShadow(token.layers) }} />
    </i>
);

const tokenValue = (token: DimensionToken) =>
    token.fullRounding || token.valuePx === null ? 'Full' : String(token.valuePx);

const RadiusBoard = ({ tokens, selectedId, themeName, onSelect }: BoardProps) => {
    const radii = tokens.filter((token): token is DimensionToken => token.kind === 'radius');
    const offsets = [...new Set(radii.flatMap((token) => token.derived.map((item) => item.offsetPx)))].sort(
        (a, b) => a - b,
    );
    const components = [
        ...new Set(
            radii.flatMap((token) => token.derived.flatMap((item) => item.usages.map((usage) => usage.component))),
        ),
    ];
    return (
        <>
            <Section title="Радиусы" description={`Шкала скруглений темы ${themeName}`}>
                <DataRow title="Radius" caption="Семантические">
                    {radii.map((token) => (
                        <Tile
                            key={token.tokenId}
                            name={shortName(token)}
                            value={tokenValue(token)}
                            label={token.name}
                            selected={selectedId === token.tokenId}
                            preview={radiusPreview(token.fullRounding ? null : (token.valuePx ?? 0))}
                            onClick={() => onSelect(token)}
                        />
                    ))}
                </DataRow>
            </Section>
            {offsets.length > 0 && (
                <Section
                    title="Вычисляемые"
                    description={`Источник и смещение из компонентов: ${components.join(', ')}`}
                    note="Только для чтения: смещение задаётся в компоненте, значение следует за источником."
                    testId="derived-radii"
                >
                    {offsets.map((offset) => (
                        <DataRow
                            key={offset}
                            title={`Radius ${offset < 0 ? '−' : '+'}${Math.abs(offset)}`}
                            caption="Вычисляемые"
                        >
                            {radii.flatMap((token) =>
                                token.derived
                                    .filter((item) => item.offsetPx === offset)
                                    .map((item) => {
                                        const value = derivedValue(token, item.offsetPx);
                                        const used = [...new Set(item.usages.map((usage) => usage.component))];
                                        const label = derivedLabel(token, item.offsetPx);
                                        return (
                                            <Tile
                                                key={token.tokenId}
                                                name={label}
                                                value={String(value)}
                                                label={`${label}, ${value} px, ${used.join(', ')}`}
                                                title={`${value} px · ${used.join(', ')}`}
                                                preview={radiusPreview(value)}
                                                onClick={() => onSelect(token)}
                                            />
                                        );
                                    }),
                            )}
                        </DataRow>
                    ))}
                </Section>
            )}
        </>
    );
};

const SpacingBoard = ({ tokens, selectedId, onSelect }: BoardProps) => {
    const spacing = tokens.filter((token): token is DimensionToken => token.kind === 'spacing');
    return (
        <Section title="Отступы" description="Шкала отступов темы: Nx = N × 2 px">
            <DataRow title="Spacing" caption="Промежутки">
                {spacing.map((token) => (
                    <Tile
                        key={token.tokenId}
                        name={shortName(token)}
                        value={tokenValue(token)}
                        label={token.name}
                        selected={selectedId === token.tokenId}
                        preview={spacingPreview(token.valuePx ?? 0)}
                        onClick={() => onSelect(token)}
                    />
                ))}
            </DataRow>
        </Section>
    );
};

/**
 * Тени — теми же строками: имя тени произвольное, строка — группа по началу имени (`down.soft` у `down.soft.m`),
 * плитка — последняя часть имени; тени без точки (`card`) — строка «Без группы».
 */
const ShadowBoard = ({ tokens, selectedId, onSelect }: BoardProps) => {
    const shadows = tokens.filter((token): token is ShadowToken => token.kind === 'shadow').sort(compareTokens);
    const groups = [...new Set(shadows.map((token) => shadowParts(token.name).group))];
    return (
        <Section title="Тени" description="Тени темы по группам имён">
            <div className="st-board-rows tw-board-rows" data-testid="shadow-grid">
                {groups.map((group) => {
                    const row = shadows.filter((token) => shadowParts(token.name).group === group);
                    return (
                        <DataRow
                            key={group || '—'}
                            title={group ? groupLabel(group) : 'Без группы'}
                            caption={group ? `${group}.*` : 'Тени без точки в имени'}
                        >
                            {row.map((token) => (
                                <Tile
                                    key={token.tokenId}
                                    name={group ? sizeLabel(shadowParts(token.name).size) : shortName(token)}
                                    value={rowValue({ ...token, layers: token.layers.slice(0, 1) })}
                                    label={token.name}
                                    title={`${token.name} · ${rowValue(token)}`}
                                    selected={selectedId === token.tokenId}
                                    preview={shadowPreview(token)}
                                    onClick={() => onSelect(token)}
                                />
                            ))}
                        </DataRow>
                    );
                })}
            </div>
        </Section>
    );
};

/** Борд раздела выбранного токена: шкала радиусов, шкала отступов или строки теней. */
export const SizeTokenBoard = (props: BoardProps) => (
    <div className="st-board tw-board">
        {props.kind === 'shadow' ? (
            <ShadowBoard {...props} />
        ) : props.kind === 'spacing' ? (
            <SpacingBoard {...props} />
        ) : (
            <RadiusBoard {...props} />
        )}
    </div>
);
