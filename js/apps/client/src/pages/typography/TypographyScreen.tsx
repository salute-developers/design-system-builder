import { useEffect, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import '../../styles/typography.css';

import type { DesignSystem, Theme } from '../../controllers';
import {
    DEFAULT_STYLE_KEY,
    screenLabel,
    screenStyles,
    styleKey,
    type TypographyContext,
    type TypographyScreen as Screen,
} from '../../modules/typographyTokens';
import { useTypographyEditor } from './useTypographyEditor';
import { TyGlyph } from './ui/TyGlyph';
import { TypographyBoard } from './ui/TypographyBoard';
import { TypographyInspector } from './ui/TypographyInspector';
import { TypographyTree } from './ui/TypographyTree';

export interface TypographyScreenProps {
    context: TypographyContext;
    designSystem: DesignSystem;
    theme: Theme;
    rerender: () => void;
}

const PANELS_KEY = 'ds_typography_panels';
const COLLAPSED_KEY = 'ds_typography_collapsed';
const LEFT = { min: 220, max: 320, initial: 280 };
const RIGHT = { min: 280, max: 400, initial: 320 };

const readStorage = <T,>(key: string, fallback: T): T => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    } catch {
        return fallback;
    }
};

const writeStorage = (key: string, value: unknown) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Хранилище браузера недоступно: настройка просто не запомнится.
    }
};

const clampWidth = (value: number, { min, max }: { min: number; max: number }) =>
    Math.min(max, Math.max(min, Math.round(value)));

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Экран Typography темы по ветке `editorTab === 'fonts'` функции `editor` прототипа. */
export const TypographyScreen = (props: TypographyScreenProps) => {
    const { context, designSystem, theme, rerender } = props;
    const navigate = useNavigate();
    const editor = useTypographyEditor({ context, designSystem, theme, rerender });
    const { styles, status, conflict } = editor;
    const readOnly = designSystem.getParameters()?.readOnly === true || styles?.canEdit === false;

    const [screen, setScreen] = useState<Screen>('screen-l');
    const [selectedKey, setSelectedKey] = useState(DEFAULT_STYLE_KEY);
    const [query, setQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => readStorage(COLLAPSED_KEY, {}));
    const [panels, setPanels] = useState(() => readStorage(PANELS_KEY, { left: LEFT.initial, right: RIGHT.initial }));
    const [legacyBusy, setLegacyBusy] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => writeStorage(PANELS_KEY, panels), [panels]);
    useEffect(() => writeStorage(COLLAPSED_KEY, collapsed), [collapsed]);

    const current = screenStyles(styles, screen);
    const selected =
        current.find((style) => styleKey(style) === selectedKey) ??
        current.find((style) => styleKey(style) === DEFAULT_STYLE_KEY) ??
        current[0] ??
        null;

    /** Стиль, которого нет на новом экране, сменяется на Body M. */
    const changeScreen = (next: Screen) => {
        setScreen(next);
        if (!screenStyles(styles, next).some((style) => styleKey(style) === selectedKey))
            setSelectedKey(DEFAULT_STYLE_KEY);
    };

    const resize = (side: 'left' | 'right') => ({
        onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
            const section = event.currentTarget.parentElement;
            if (!section) return;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            const start = event.clientX;
            const initial = panels[side];
            const limits = side === 'left' ? LEFT : RIGHT;
            const target = event.currentTarget;
            let width = initial;
            const move = (moveEvent: globalThis.PointerEvent) => {
                const delta = moveEvent.clientX - start;
                width = clampWidth(side === 'left' ? initial + delta : initial - delta, limits);
                section.style.setProperty(`--panel-${side}`, `${width}px`);
            };
            const up = () => {
                target.removeEventListener('pointermove', move);
                target.removeEventListener('pointerup', up);
                setPanels((value: typeof panels) => ({ ...value, [side]: width }));
            };
            target.addEventListener('pointermove', move);
            target.addEventListener('pointerup', up);
        },
        onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
            const limits = side === 'left' ? LEFT : RIGHT;
            const step = event.shiftKey ? 16 : 8;
            const direction = side === 'left' ? 1 : -1;
            const next =
                event.key === 'ArrowRight'
                    ? panels[side] + step * direction
                    : event.key === 'ArrowLeft'
                      ? panels[side] - step * direction
                      : null;
            if (next === null) return;
            event.preventDefault();
            setPanels((value: typeof panels) => ({ ...value, [side]: clampWidth(next, limits) }));
        },
    });

    const saveLabel = conflict
        ? 'Тема изменена в другом месте'
        : status.state === 'error'
          ? 'Не сохранено'
          : status.state === 'saved'
            ? 'Сохранено'
            : 'Сохранение…';
    const title = designSystem.getName() || 'Design System';
    const themeName = theme.getName?.() || '';

    const banners = (
        <>
            {conflict && (
                <div className="ty-banner" role="alert">
                    Тема изменена в другом месте, стили перезагружены. Ваши несохранённые правки сохранены в редакторе —
                    нажмите «Повторить», чтобы отправить их.
                </div>
            )}
            {status.state === 'error' && status.error && !conflict && (
                <div className="ty-banner" role="alert">
                    {status.error.message}
                </div>
            )}
            {notice && (
                <div className="ty-banner" role="status">
                    {notice}
                </div>
            )}
            {readOnly && (
                <div className="viewer-banner">
                    <span>Read-only access</span>
                </div>
            )}
            {editor.legacyCount > 0 && !readOnly && (
                <div className="ty-banner" role="status" data-testid="typography-legacy-draft">
                    <span>В черновике есть несохранённые правки типографии: {editor.legacyCount}</span>
                    <button
                        type="button"
                        className="ty-inline-action"
                        disabled={legacyBusy}
                        onClick={async () => {
                            if (legacyBusy) return;
                            setLegacyBusy(true);
                            try {
                                await editor.saveLegacyDraft();
                                setNotice('Правки из черновика сохранены.');
                            } catch (error) {
                                setNotice(`Не удалось сохранить черновик: ${errorText(error)}`);
                            }
                            setLegacyBusy(false);
                        }}
                    >
                        Сохранить
                    </button>
                    <button
                        type="button"
                        className="ty-inline-action"
                        disabled={legacyBusy}
                        onClick={editor.discardLegacyDraft}
                    >
                        Отбросить
                    </button>
                </div>
            )}
        </>
    );

    return (
        <div className="typography-screen ty-shell ty-theme-workspace" data-testid="typography-screen">
            <section
                className="editor-workbench playground-workbench editor-fonts-workbench"
                style={{ '--panel-left': `${panels.left}px`, '--panel-right': `${panels.right}px` } as CSSProperties}
            >
                <button
                    type="button"
                    className="panel-resizer panel-resizer-left"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Ширина сайдбара"
                    aria-valuemin={LEFT.min}
                    aria-valuemax={LEFT.max}
                    aria-valuenow={panels.left}
                    title="Изменить ширину сайдбара"
                    {...resize('left')}
                />
                <button
                    type="button"
                    className="panel-resizer panel-resizer-right"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label="Ширина инспектора"
                    aria-valuemin={RIGHT.min}
                    aria-valuemax={RIGHT.max}
                    aria-valuenow={panels.right}
                    title="Изменить ширину инспектора"
                    {...resize('right')}
                />
                <TypographyTree
                    title={title}
                    styles={current}
                    screen={screen}
                    selectedKey={selected ? styleKey(selected) : selectedKey}
                    query={query}
                    searchOpen={searchOpen}
                    collapsed={collapsed}
                    onScreen={changeScreen}
                    onSelect={setSelectedKey}
                    onQuery={setQuery}
                    onSearchOpen={setSearchOpen}
                    onToggle={(group) => setCollapsed((value) => ({ ...value, [group]: !value[group] }))}
                />
                <header className="editor-toolbar">
                    <div className="preview-toolbar">
                        <div className="editor-header-controls">
                            <span
                                className={`ty-save-status ${status.state === 'error' || conflict ? 'is-error' : ''}`}
                                role="status"
                                data-testid="typography-save-status"
                            >
                                <span className="ty-save-label" title={saveLabel}>
                                    {saveLabel}
                                </span>
                                {(status.state === 'error' || conflict) && (
                                    <button type="button" onClick={editor.retry}>
                                        Повторить
                                    </button>
                                )}
                            </span>
                            <div className="editor-canvas-picker">
                                <button
                                    type="button"
                                    className="editor-header-select"
                                    title="Представление рабочей области"
                                >
                                    <span>Типографика</span>
                                    <TyGlyph name="chevron-down" />
                                </button>
                            </div>
                        </div>
                    </div>
                </header>
                <aside className="properties-panel">
                    {editor.loadError && (
                        <div className="ty-banner" role="alert">
                            Не удалось загрузить стили типографии: {editor.loadError}
                            <button type="button" className="ty-inline-action" onClick={() => void editor.reload()}>
                                Повторить
                            </button>
                        </div>
                    )}
                    {selected && styles && (
                        <TypographyInspector
                            style={selected}
                            families={styles.families}
                            themeCount={styles.themeCount}
                            editable={!readOnly}
                            banners={banners}
                            error={(field) => editor.fieldError(selected, field)}
                            onChange={(change) => editor.edit(selected, change)}
                            onOpenComponent={(name) => navigate(`../components/${name}`)}
                        />
                    )}
                </aside>
                <main className="preview-canvas">
                    <div className="canvas-toolbar">
                        <button type="button">Типографика</button>
                        <div>
                            {screenLabel(screen)}
                            {themeName ? ` · ${themeName}` : ''}
                        </div>
                    </div>
                    {styles ? (
                        <TypographyBoard
                            title={themeName || title}
                            styles={current}
                            families={styles.families}
                            selectedKey={selected ? styleKey(selected) : selectedKey}
                            onSelect={setSelectedKey}
                        />
                    ) : (
                        !editor.loadError && (
                            <div className="ty-loading" role="status">
                                Загружаем стили типографии…
                            </div>
                        )
                    )}
                </main>
            </section>
        </div>
    );
};
