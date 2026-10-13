import { useEffect, useRef } from 'react';

import { boardCategories, SECTION_LABELS, type ColorTokenView, type TreeSection } from '../../../modules/colorTokens';
import { alphaSwatchStyle, swatchLabel } from './swatch';

interface BoardProps {
    sections: TreeSection[];
    selectedId: string | null;
    onSelect: (view: ColorTokenView) => void;
}

/** Борд свотчей по `linkedColorTokenCanvas` прототипа: разделы, категории и карточки Light/Dark. */
export const ColorTokenBoard = ({ sections, selectedId, onSelect }: BoardProps) => {
    const board = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!selectedId) return;
        const card = board.current?.querySelector<HTMLElement>(`[data-token-id="${CSS.escape(selectedId)}"]`);
        card?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }, [selectedId]);
    return (
        <div className="token-canvas">
            <div className="token-swatch-board" ref={board}>
                {sections.map(({ section, tokens }) => (
                    <section key={section} className="token-swatch-group token-swatch-section">
                        <div className="token-swatch-head token-swatch-head-default">
                            <h3>{SECTION_LABELS[section]}</h3>
                        </div>
                        {boardCategories(tokens).map(({ category, tokens: entries }) => (
                            <div key={category} className="token-swatch-category">
                                <div className="token-swatch-category-title">{category}</div>
                                <div className="token-default-grid">
                                    {entries.map((token) => {
                                        const light = token.modes.light.resolved;
                                        const dark = token.modes.dark.resolved;
                                        const lightLabel = swatchLabel(light);
                                        const darkLabel = swatchLabel(dark);
                                        return (
                                            <button
                                                key={token.id}
                                                type="button"
                                                data-token-id={token.id}
                                                className={`token-swatch-card token-swatch-card-split ${selectedId === token.id ? 'is-selected' : ''}`}
                                                title={`${token.displayName} - Light ${token.modes.light.value} / Dark ${token.modes.dark.value}`}
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
