import { useEffect, useState, type ReactNode } from 'react';

import { InspectorHeader, SectionHeader } from '../../components/tokenWorkspace';
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
import { findRamp, stepOf, type PaletteSelection } from './Palette.utils';
import type { PaletteEditor } from './usePaletteEditor';

interface PaletteInspectorProps {
    context: PaletteContext;
    palette: ThemePalette;
    /** Выбор, видимый после поиска и фильтра; `null` — растяжка не выбрана или скрыта. */
    selection: PaletteSelection | null;
    editor: PaletteEditor;
    canEdit: boolean;
    /** Баннеры раздела («Только просмотр») над содержимым, как на экранах токенов. */
    banners?: ReactNode;
    onOpenToken: (tokenName: string, mode: string | null) => void;
    onOpenColors: () => void;
}

/** Связанные токены по `sourcePaletteUsageForScope` прототипа: одна строка на токен, режимы объединены. */
const byToken = (links: PaletteLink[]) => {
    const tokens = new Map<string, PaletteLink>();
    for (const link of links) if (!tokens.has(link.tokenId)) tokens.set(link.tokenId, link);
    return [...tokens.values()];
};

/** Инспектор `Inspector · Palette`: шапка растяжки, источник палитры, связанные токены, в режиме «Цвет» — цвет ступени. */
export const PaletteInspector = ({
    context,
    palette,
    selection,
    editor,
    canEdit,
    banners,
    onOpenToken,
    onOpenColors,
}: PaletteInspectorProps) => {
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
            <aside className="palette-inspector">
                {banners}
                <p className="palette-inspector-empty">Выберите палитру или цвет.</p>
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
    const title = paletteMode ? ramp.displayName : `${ramp.displayName} ${selection.step}`;
    const description = `${group.label} · ${sourceName}${hue === '—' ? '' : ` ${hue}`}`;

    return (
        <aside className="palette-inspector">
            {banners}
            <InspectorHeader title={title} description={description} />
            {!paletteMode && (
                // Ревью дизайна (PR #101): выбор цвета ступени открывается отсюда или двойным щелчком по свотчу.
                <section className="tw-section">
                    <SectionHeader title="Цвет" />
                    <div className="tw-list-row palette-step-color">
                        <span className="palette-step-color-value">
                            <i className="palette-swatch" aria-hidden="true" style={{ background: stepValue }} />
                            {stepValue}
                        </span>
                        {canEdit && (
                            <button
                                type="button"
                                className="tw-action-button"
                                onClick={(event) => editor.openStepEditor(selection, event.currentTarget)}
                            >
                                Изменить цвет
                            </button>
                        )}
                    </div>
                </section>
            )}
            <section className="tw-section">
                <SectionHeader title="Источник палитры" />
                <div className="tw-list-row">
                    <span>Семейство</span>
                    <b>{sourceName}</b>
                </div>
                <div className="tw-list-row">
                    <span>Оттенок</span>
                    <b>{hue}</b>
                </div>
            </section>
            <section className="tw-section">
                <SectionHeader title={`Связанные токены · ${usage.length}`} />
                <div className="palette-tabs palette-usage-scope" role="tablist" aria-label="Область связей">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={editor.usageScope === 'group'}
                        className={editor.usageScope === 'group' ? 'is-active' : ''}
                        title={
                            paletteMode
                                ? 'Связи всей растяжки в текущей группе'
                                : 'Связи выбранного цвета в текущей группе'
                        }
                        onClick={() => editor.setUsageScope('group')}
                    >
                        {group.label} {groupTokens.length}
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={editor.usageScope === 'all'}
                        className={editor.usageScope === 'all' ? 'is-active' : ''}
                        title={
                            paletteMode
                                ? 'Связи всей растяжки во всех группах'
                                : 'Связи выбранного цвета во всех группах'
                        }
                        onClick={() => editor.setUsageScope('all')}
                    >
                        Все {allTokens.length}
                    </button>
                </div>
                {usage.length ? (
                    <div className="palette-usage-list">
                        {usage.map((link) => {
                            const linkRamp = findRamp(palette, link.groupId, selection.slot);
                            const hex = linkRamp ? stepOf(linkRamp, link.step)?.value : stepValue;
                            const name = link.displayName ?? link.tokenName;
                            return (
                                <button
                                    key={link.tokenId}
                                    type="button"
                                    className="tw-list-row is-link palette-usage-link"
                                    title={`Открыть ${name}`}
                                    onClick={() => onOpenToken(link.tokenName, link.mode)}
                                >
                                    <span className="palette-usage-name">
                                        <i
                                            className="palette-swatch"
                                            aria-hidden="true"
                                            style={{ background: hex ? withOpacity(hex, link.opacity) : stepValue }}
                                        />
                                        <span>{name}</span>
                                    </span>
                                    <b>Открыть</b>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="palette-usage-empty">
                        <p>Пока нет связанных семантических токенов.</p>
                        {group.kind === 'custom' && (
                            <button type="button" className="tw-action-button is-secondary" onClick={onOpenColors}>
                                Перейти в Color tokens
                            </button>
                        )}
                    </div>
                )}
            </section>
        </aside>
    );
};
