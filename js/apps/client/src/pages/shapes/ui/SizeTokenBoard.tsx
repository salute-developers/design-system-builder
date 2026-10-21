import type { CSSProperties } from 'react';

import {
    boxShadow,
    shadowSizes,
    sizeLabel,
    shortName,
    SHADOW_VARIANTS,
    variantLabel,
    type DimensionToken,
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

const tokensLabel = (count: number) => {
    const tail = count % 100 >= 11 && count % 100 <= 14 ? 5 : count % 10;
    return `${count} ${tail === 1 ? 'токен' : tail >= 2 && tail <= 4 ? 'токена' : 'токенов'}`;
};

/** Подпись вычисляемого радиуса: «L − 2». */
export const derivedLabel = (token: DimensionToken, offsetPx: number) =>
    `${shortName(token)} ${offsetPx < 0 ? '−' : '+'} ${Math.abs(offsetPx)}`;

/** Значение вычисляемого радиуса по текущему значению источника, не меньше 0. */
export const derivedValue = (token: DimensionToken, offsetPx: number) => Math.max(0, (token.valuePx ?? 0) + offsetPx);

const preview = (px: number) => ({ '--radius-preview': `${Math.min(px, 80)}px` }) as CSSProperties;

const RadiusBoard = ({ tokens, selectedId, themeName, onSelect }: BoardProps) => {
    const radii = tokens.filter((token): token is DimensionToken => token.kind === 'radius');
    const derived = radii.flatMap((token) => token.derived.map((item) => ({ token, item })));
    return (
        <div className="token-canvas sizing-canvas">
            <div className="radius-overview-board">
                <header className="radius-overview-intro">
                    <strong>Радиусы компонентов</strong>
                    <p>Шкала скруглений темы {themeName}.</p>
                </header>
                <div
                    className="radius-overview-grid"
                    style={{ gridTemplateColumns: derived.length ? '1fr 1fr' : '1fr' }}
                >
                    <section className="radius-overview-group">
                        <header className="radius-overview-group-header">
                            <img src="/catalog/icons/rail-corner-radius.svg" alt="" />
                            <span>
                                <strong>Радиусы</strong>
                                <small>{tokensLabel(radii.length)}</small>
                            </span>
                        </header>
                        <div className="radius-overview-list">
                            {radii.map((token) => (
                                <button
                                    key={token.tokenId}
                                    type="button"
                                    className={`radius-overview-row ${selectedId === token.tokenId ? 'is-selected' : ''}`}
                                    onClick={() => onSelect(token)}
                                >
                                    <span className="radius-overview-meta">
                                        <strong>{shortName(token)}</strong>
                                        <small>
                                            {token.fullRounding ? 'Полное скругление' : `${token.valuePx} px`}
                                        </small>
                                    </span>
                                    <span className="radius-overview-preview" aria-hidden="true">
                                        <i style={preview(token.fullRounding ? 80 : (token.valuePx ?? 0))} />
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>
                    {derived.length > 0 && (
                        <section className="radius-overview-group" data-testid="derived-radii">
                            <header className="radius-overview-group-header">
                                <img src="/catalog/icons/rail-corner-radius.svg" alt="" />
                                <span>
                                    <strong>Вычисляемые</strong>
                                    <small>Источник и смещение из компонентов</small>
                                </span>
                            </header>
                            <div className="radius-overview-list">
                                {derived.map(({ token, item }) => {
                                    const value = derivedValue(token, item.offsetPx);
                                    const components = [...new Set(item.usages.map((usage) => usage.component))];
                                    return (
                                        <button
                                            key={`${token.tokenId}:${item.offsetPx}`}
                                            type="button"
                                            className="radius-overview-row"
                                            onClick={() => onSelect(token)}
                                        >
                                            <span className="radius-overview-meta">
                                                <strong>{derivedLabel(token, item.offsetPx)}</strong>
                                                <small>
                                                    {value} px · {components.join(', ')}
                                                </small>
                                            </span>
                                            <span className="radius-overview-preview" aria-hidden="true">
                                                <i style={preview(value)} />
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="radius-overview-note">
                                Только для чтения: смещение задаётся в компоненте, значение следует за источником.
                            </p>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};

const SpacingBoard = ({ tokens, selectedId, onSelect }: BoardProps) => {
    const spacing = tokens.filter((token): token is DimensionToken => token.kind === 'spacing');
    const selected = spacing.find((token) => token.tokenId === selectedId);
    return (
        <div className="token-canvas sizing-canvas spatial-canvas">
            <div className="spatial-board">
                <header className="spatial-board-header">
                    <strong>{selected ? `${selected.name} · ${selected.valuePx} px` : 'Отступы'}</strong>
                </header>
                <div className="spatial-scale-list">
                    <section className="spatial-scale-strip is-gap">
                        <div className="spatial-scale-label">
                            <i className="spatial-kind-glyph" aria-hidden="true" />
                            <strong>Spacing</strong>
                        </div>
                        <div className="spatial-scale-items st-scale-items">
                            {spacing.map((token) => (
                                <button
                                    key={token.tokenId}
                                    type="button"
                                    className={`spatial-scale-item ${selectedId === token.tokenId ? 'is-selected' : ''}`}
                                    style={{ '--space': `${token.valuePx ?? 0}px` } as CSSProperties}
                                    onClick={() => onSelect(token)}
                                >
                                    <span className="spatial-scale-name">{shortName(token)}</span>
                                    <i className="spatial-scale-demo" aria-hidden="true">
                                        <b />
                                        <b />
                                    </i>
                                    <small>{token.valuePx} px</small>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

/** Список теней по размерам: каждая тень на своей плашке, чтобы крупные тени не заходили на соседние. */
const ShadowBoard = ({ tokens, selectedId, onSelect }: BoardProps) => {
    const byName = new Map(tokens.map((token) => [token.name, token]));
    return (
        <div className="token-canvas sizing-canvas">
            <div className="st-shadow-board">
                <header>
                    <strong>Тени</strong>
                    <p>Направление и жёсткость по размерам. Строка — токен.</p>
                </header>
                <div className="st-shadow-list" data-testid="shadow-grid">
                    {shadowSizes(tokens).map((size) => (
                        <section key={size} className="st-shadow-size">
                            <h3>{sizeLabel(size).toUpperCase()}</h3>
                            {SHADOW_VARIANTS.map((variant) => {
                                const token = byName.get(`${variant}.${size}`);
                                if (token?.kind !== 'shadow') return null;
                                const selected = selectedId === token.tokenId;
                                return (
                                    <button
                                        key={token.tokenId}
                                        type="button"
                                        className={`st-shadow-row ${selected ? 'is-selected' : ''}`}
                                        aria-label={token.name}
                                        aria-pressed={selected}
                                        onClick={() => onSelect(token)}
                                    >
                                        <span className="st-shadow-meta">
                                            <strong>{variantLabel(variant)}</strong>
                                            <small>{token.name}</small>
                                            <small>{rowValue(token)}</small>
                                        </span>
                                        <span className="st-shadow-tile" aria-hidden="true">
                                            <i
                                                className="st-shadow-card"
                                                style={{ boxShadow: boxShadow(token.layers) }}
                                            />
                                        </span>
                                    </button>
                                );
                            })}
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
};

/** Борд раздела выбранного токена: шкала радиусов, шкала отступов или сетка теней. */
export const SizeTokenBoard = (props: BoardProps) =>
    props.kind === 'shadow' ? (
        <ShadowBoard {...props} />
    ) : props.kind === 'spacing' ? (
        <SpacingBoard {...props} />
    ) : (
        <RadiusBoard {...props} />
    );
