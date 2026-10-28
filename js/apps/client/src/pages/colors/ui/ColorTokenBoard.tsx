import { useEffect, useRef } from 'react';

import { fieldText, type ColorTokenView, type TreeGroup } from '../../../modules/colorTokens';
import { alphaSwatchStyle, swatchLabel } from './swatch';

interface BoardProps {
    tree: TreeGroup[];
    selectedId: string | null;
    onSelect: (view: ColorTokenView) => void;
}

/**
 * Борд свотчей по `linkedColorTokenCanvas` прототипа: группы, токены группы без подгруппы, затем подгруппы и
 * карточки Light/Dark; пустые группы и подгруппы не выводятся.
 */
export const ColorTokenBoard = ({ tree, selectedId, onSelect }: BoardProps) => {
    const board = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!selectedId) return;
        const card = board.current?.querySelector<HTMLElement>(`[data-token-id="${CSS.escape(selectedId)}"]`);
        card?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }, [selectedId]);
    return (
        <div className="token-canvas">
            <div className="token-swatch-board" ref={board}>
                {tree
                    .map((node) => ({
                        node,
                        blocks: [
                            ...(node.tokens.length ? [{ id: node.group.id, label: null, tokens: node.tokens }] : []),
                            ...node.subgroups
                                .filter((item) => item.tokens.length)
                                .map((item) => ({ id: item.group.id, label: item.group.label, tokens: item.tokens })),
                        ],
                    }))
                    .filter(({ blocks }) => blocks.length)
                    .map(({ node, blocks }) => (
                        <section key={node.group.id} className="token-swatch-group token-swatch-section">
                            <div className="token-swatch-head token-swatch-head-default">
                                <h3>{node.group.label}</h3>
                            </div>
                            {blocks.map(({ id, label, tokens: entries }) => (
                                <div key={id} className="token-swatch-category">
                                    {label && <div className="token-swatch-category-title">{label}</div>}
                                    <div className="token-default-grid">
                                        {entries.map((token: ColorTokenView) => {
                                            const light = token.modes.light.resolved;
                                            const dark = token.modes.dark.resolved;
                                            // У градиента нет одного цвета: подпись — по контрасту с первым стопом.
                                            const lightLabel = swatchLabel(token.modes.light.baseColor);
                                            const darkLabel = swatchLabel(token.modes.dark.baseColor);
                                            return (
                                                <button
                                                    key={token.id}
                                                    type="button"
                                                    data-token-id={token.id}
                                                    className={`token-swatch-card token-swatch-card-split ${selectedId === token.id ? 'is-selected' : ''}`}
                                                    title={`${token.displayName} - Light ${fieldText(token.modes.light)} / Dark ${fieldText(token.modes.dark)}`}
                                                    onClick={() => onSelect(token)}
                                                >
                                                    <span
                                                        className={`token-swatch-half token-swatch-light alpha-swatch ${lightLabel.className}`}
                                                        style={
                                                            {
                                                                ...alphaSwatchStyle(light),
                                                                '--token-swatch-label-color': lightLabel.color,
                                                            } as React.CSSProperties
                                                        }
                                                    >
                                                        <b>Light</b>
                                                    </span>
                                                    <span
                                                        className={`token-swatch-half token-swatch-dark-mode alpha-swatch ${darkLabel.className}`}
                                                        style={
                                                            {
                                                                ...alphaSwatchStyle(dark),
                                                                '--token-swatch-label-color': darkLabel.color,
                                                            } as React.CSSProperties
                                                        }
                                                    >
                                                        <b>Dark</b>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </section>
                    ))}
            </div>
        </div>
    );
};
