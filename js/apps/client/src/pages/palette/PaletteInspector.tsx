import { useEffect, useState } from 'react';

import {
    hexToRgba,
    rgbToHsl,
    templateRampName,
    withOpacity,
    type PaletteContext,
    type PaletteLink,
    type ThemePalette,
} from '../../modules/palette';
import { paletteRepository } from '../../palette/paletteSession';
import { findRamp, stepOf } from './Palette.utils';
import type { PaletteEditor } from './usePaletteEditor';

interface PaletteInspectorProps {
    context: PaletteContext;
    palette: ThemePalette;
    editor: PaletteEditor;
    onOpenToken: (tokenName: string, mode: string | null) => void;
    onOpenColors: () => void;
}

/** Связанные токены по `sourcePaletteUsageForScope` прототипа: одна строка на токен, режимы объединены. */
const byToken = (links: PaletteLink[]) => {
    const tokens = new Map<string, PaletteLink>();
    for (const link of links) if (!tokens.has(link.tokenId)) tokens.set(link.tokenId, link);
    return [...tokens.values()];
};

/** Инспектор по `sourcePaletteSelectedPanelV3` прототипа: источник палитры и связанные токены. */
export const PaletteInspector = ({ context, palette, editor, onOpenToken, onOpenColors }: PaletteInspectorProps) => {
    const selection = editor.selection;
    const group = palette.groups.find((item) => item.id === selection?.groupId);
    const ramp = selection ? findRamp(palette, selection.groupId, selection.slot) : undefined;
    const paletteMode = editor.mode === 'palette';
    const [groupLinks, setGroupLinks] = useState<PaletteLink[]>([]);
    const [allLinks, setAllLinks] = useState<PaletteLink[]>([]);

    useEffect(() => {
        if (!selection) {
            setGroupLinks([]);
            setAllLinks([]);
            return;
        }
        let cancelled = false;
        const step = paletteMode ? undefined : selection.step;
        Promise.all([
            paletteRepository.links(context, { slot: selection.slot, groupId: selection.groupId, step }),
            paletteRepository.links(context, { slot: selection.slot, step }),
        ])
            .then(([inGroup, everywhere]) => {
                if (cancelled) return;
                setGroupLinks(inGroup);
                setAllLinks(everywhere);
            })
            .catch(() => {
                if (cancelled) return;
                setGroupLinks([]);
                setAllLinks([]);
            });
        return () => {
            cancelled = true;
        };
    }, [context, palette, selection, paletteMode]);

    if (!selection || !group || !ramp) {
        return (
            <aside className="source-palette-inspector-v3">
                <header className="source-palette-inspector-header">Палитра</header>
                <section className="source-palette-inspector-section source-palette-usage-card">
                    <div className="source-palette-empty-category">Выберите палитру или цвет.</div>
                </section>
            </aside>
        );
    }

    const stepValue = stepOf(ramp, selection.step)?.value;
    const sourceName = ramp.origin === 'rebuild' ? ramp.displayName : templateRampName(ramp.source);
    const hue =
        ramp.origin === 'rebuild' && ramp.anchor
            ? String(rgbToHsl(hexToRgba(ramp.anchor.value)!).h)
            : ramp.source.type === 'additional'
              ? ramp.source.shade.replace(/^h/, '')
              : '—';
    const groupTokens = byToken(groupLinks);
    const allTokens = byToken(allLinks);
    const usage = editor.usageScope === 'all' ? allTokens : groupTokens;

    return (
        <aside className="source-palette-inspector-v3">
            <header className="source-palette-inspector-header">
                {paletteMode ? group.label : `${ramp.displayName} ${selection.step}`}
            </header>
            <section className="source-palette-inspector-section source-palette-source-section">
                <h2>ИСТОЧНИК ПАЛИТРЫ</h2>
                <dl>
                    <div>
                        <dt>Семейство</dt>
                        <dd>{sourceName}</dd>
                    </div>
                    <div>
                        <dt>Оттенок</dt>
                        <dd>{hue}</dd>
                    </div>
                </dl>
            </section>
            <section className="source-palette-inspector-section source-palette-usage-card">
                <h2>СВЯЗАННЫЕ ТОКЕНЫ</h2>
                <div className="source-palette-usage-scope" role="tablist" aria-label="Область связей">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={editor.usageScope === 'group'}
                        className={editor.usageScope === 'group' ? 'is-active' : ''}
                        title={paletteMode ? 'Связи всей растяжки в текущей группе' : 'Связи выбранного цвета в текущей группе'}
                        onClick={() => editor.setUsageScope('group')}
                    >
                        {group.label} {groupTokens.length}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={editor.usageScope === 'all'}
                        className={editor.usageScope === 'all' ? 'is-active' : ''}
                        title={paletteMode ? 'Связи всей растяжки во всех группах' : 'Связи выбранного цвета во всех группах'}
                        onClick={() => editor.setUsageScope('all')}
                    >
                        Все {allTokens.length}
                    </button>
                </div>
                {usage.length ? (
                    <div className="source-palette-usage-list">
                        {usage.map((link) => {
                            const linkRamp = findRamp(palette, link.groupId, selection.slot);
                            const hex = linkRamp ? stepOf(linkRamp, link.step)?.value : stepValue;
                            const title = link.displayName ?? link.tokenName;
                            return (
                                <button
                                    key={link.tokenId}
                                    type="button"
                                    className="source-palette-usage-link"
                                    title={`Открыть ${title}`}
                                    onClick={() => onOpenToken(link.tokenName, link.mode)}
                                >
                                    <span
                                        className="source-palette-usage-swatch"
                                        style={{ background: hex ? withOpacity(hex, link.opacity) : stepValue }}
                                    />
                                    <span className="source-palette-usage-copy">
                                        <strong>{title}</strong>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="source-palette-empty-category">
                        Пока нет связанных семантических токенов.
                        {group.kind === 'custom' && (
                            <button type="button" onClick={onOpenColors}>
                                Перейти в Color tokens
                            </button>
                        )}
                    </div>
                )}
            </section>
        </aside>
    );
};
