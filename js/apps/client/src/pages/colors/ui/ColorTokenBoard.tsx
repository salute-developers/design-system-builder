import { useEffect, useRef, type CSSProperties } from 'react';

import { fieldText, type ColorFieldValue, type ColorTokenView, type TreeGroup } from '../../../modules/colorTokens';
import { checkerFill, tileLabelColor } from './swatch';

interface BoardProps {
    tree: TreeGroup[];
    selectedId: string | null;
    onSelect: (view: ColorTokenView) => void;
}

/** Половина плитки Light или Dark: цвет поверх шахматки по всей площади и подпись режима. */
const TileHalf = ({ mode, value }: { mode: 'light' | 'dark'; value: ColorFieldValue }) => (
    <span
        className={`ct-tile-half is-${mode}`}
        style={
            {
                ...checkerFill(value.resolved),
                // У градиента нет одного цвета: подпись — по контрасту с первым стопом.
                '--ct-tile-label': tileLabelColor(value.baseColor),
            } as CSSProperties
        }
    >
        <b>{mode === 'light' ? 'Light' : 'Dark'}</b>
    </span>
);

/**
 * Борд токенов `Workspace/DataRow` по Figma: секция группы с заголовком, строки подгрупп с колонкой метаданных
 * 114 px и плитками 120×100 в одну строку. Токены группы без подгруппы — первая строка с названием группы;
 * пустые группы и подгруппы не выводятся.
 */
export const ColorTokenBoard = ({ tree, selectedId, onSelect }: BoardProps) => {
    const board = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!selectedId) return;
        const card = board.current?.querySelector<HTMLElement>(`[data-token-id="${CSS.escape(selectedId)}"]`);
        card?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }, [selectedId]);
    return (
        <div className="ct-board tw-board" ref={board}>
            {tree
                .map((node) => ({
                    node,
                    rows: [
                        ...(node.tokens.length
                            ? [{ id: node.group.id, label: node.group.label, tokens: node.tokens }]
                            : []),
                        ...node.subgroups
                            .filter((item) => item.tokens.length)
                            .map((item) => ({ id: item.group.id, label: item.group.label, tokens: item.tokens })),
                    ],
                }))
                .filter(({ rows }) => rows.length)
                .map(({ node, rows }) => (
                    <section key={node.group.id} className="ct-board-section tw-board-section">
                        <header className="tw-board-heading">
                            <h3 className="ct-board-title tw-board-title">{node.group.label}</h3>
                        </header>
                        {rows.map(({ id, label, tokens }) => (
                            <div key={id} className="ct-board-row tw-data-row">
                                <div className="ct-board-meta tw-meta">
                                    <strong>{label}</strong>
                                </div>
                                {tokens.map((token) => (
                                    <button
                                        key={token.id}
                                        type="button"
                                        data-token-id={token.id}
                                        className={`ct-tile tw-tile ${selectedId === token.id ? 'is-selected' : ''}`}
                                        aria-pressed={selectedId === token.id}
                                        title={`${token.displayName} - Light ${fieldText(token.modes.light)} / Dark ${fieldText(token.modes.dark)}`}
                                        onClick={() => onSelect(token)}
                                    >
                                        <TileHalf mode="light" value={token.modes.light} />
                                        <TileHalf mode="dark" value={token.modes.dark} />
                                    </button>
                                ))}
                            </div>
                        ))}
                    </section>
                ))}
        </div>
    );
};
