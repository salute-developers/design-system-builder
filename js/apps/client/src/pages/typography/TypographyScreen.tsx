import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import '../../styles/typography.css';

import type { DesignSystem, Theme } from '../../controllers';
import { useAddressedToken } from '../../hooks/useAddressedToken';
import {
    DEFAULT_STYLE_KEY,
    parseStyleTokenName,
    screenLabel,
    screenStyles,
    styleKey,
    type TypographyContext,
    type TypographyScreen as Screen,
    type TypographyVariant,
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
    changedTokenNames?: Set<string>;
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

/** Экран Typography темы по ветке `editorTab === 'fonts'` функции `editor` прототипа. */
export const TypographyScreen = (props: TypographyScreenProps) => {
    const { context, designSystem, theme, rerender, changedTokenNames } = props;
    const navigate = useNavigate();
    const readOnlyAccess = designSystem.getParameters()?.readOnly === true || Boolean(context.versionId);
    const editor = useTypographyEditor({ context, designSystem, theme, rerender, readOnly: readOnlyAccess });
    const { styles, status } = editor;
    const readOnly = readOnlyAccess || styles?.canEdit === false;

    const [screen, setScreen] = useState<Screen>('screen-l');
    const [selectedKey, setSelectedKey] = useState(DEFAULT_STYLE_KEY);
    const [variant, setVariant] = useState<TypographyVariant>('normal');
    const [query, setQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => readStorage(COLLAPSED_KEY, {}));
    const [panels, setPanels] = useState(() => readStorage(PANELS_KEY, { left: LEFT.initial, right: RIGHT.initial }));

    useEffect(() => writeStorage(PANELS_KEY, panels), [panels]);
    useEffect(() => writeStorage(COLLAPSED_KEY, collapsed), [collapsed]);

    // Адрес из журнала: `?tokenId` выбирает экран и стиль токена; токен вне стилей темы — недоступный источник.
    const addressed = useAddressedToken(context, (name) => {
        if (!styles) return true;
        const target = parseStyleTokenName(name);
        return Boolean(target && screenStyles(styles, target.screen).some((style) => styleKey(style) === target.key));
    });
    const appliedAddress = useRef<string | null>(null);
    useEffect(() => {
        const target = addressed.requestedTokenName ? parseStyleTokenName(addressed.requestedTokenName) : null;
        if (!target || !styles || appliedAddress.current === addressed.tokenId) return;
        appliedAddress.current = addressed.tokenId ?? null;
        setScreen(target.screen);
        setSelectedKey(target.key);
    }, [addressed.requestedTokenName, addressed.tokenId, styles]);
    /** Выбор стиля сохраняет адрес в маршруте, если раздел открыт по адресу. */
    const address = (nextScreen: Screen, key: string) => {
        if (!addressed.tokenId) return;
        appliedAddress.current = null;
        addressed.selectTokenName(`${nextScreen}.${key}.normal`);
    };
    const selectStyle = (key: string) => {
        setSelectedKey(key);
        address(screen, key);
    };

    const current = screenStyles(styles, screen);
    const changedStyles = new Set(
        [...(changedTokenNames ?? [])]
            .map(parseStyleTokenName)
            .filter((target) => target?.screen === screen)
            .map((target) => target!.key),
    );
    const selected =
        current.find((style) => styleKey(style) === selectedKey) ??
        current.find((style) => styleKey(style) === DEFAULT_STYLE_KEY) ??
        current[0] ??
        null;

    /** Стиль, которого нет на новом экране, сменяется на Body M. */
    const changeScreen = (next: Screen) => {
        setScreen(next);
        const key = screenStyles(styles, next).some((style) => styleKey(style) === selectedKey)
            ? selectedKey
            : DEFAULT_STYLE_KEY;
        setSelectedKey(key);
        address(next, key);
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

    const title = designSystem.getName() || 'Design System';
    const themeName = theme.getName?.() || '';

    const banners = (
        <>
            {status.state === 'error' && status.error && (
                <div className="ty-banner" role="alert" data-testid="typography-save-error">
                    {status.error.retryable ? `${status.error.message}. Повторим автоматически.` : status.error.message}
                    <button type="button" className="ty-inline-action" onClick={editor.retry}>
                        Повторить
                    </button>
                </div>
            )}
            {readOnly && (
                <div className="viewer-banner">
                    <span>Только просмотр</span>
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
                    changedStyles={changedStyles}
                    screen={screen}
                    selectedKey={selected ? styleKey(selected) : selectedKey}
                    query={query}
                    searchOpen={searchOpen}
                    collapsed={collapsed}
                    onScreen={changeScreen}
                    onSelect={selectStyle}
                    onQuery={setQuery}
                    onSearchOpen={setSearchOpen}
                    onToggle={(group) => setCollapsed((value) => ({ ...value, [group]: !value[group] }))}
                />
                <header className="editor-toolbar">
                    <div className="preview-toolbar">
                        <div className="editor-header-controls">
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
                    {addressed.unavailable && (
                        <div className="ty-banner" role="status">
                            Точный источник токена недоступен.
                        </div>
                    )}
                    {selected && styles && (
                        <TypographyInspector
                            style={selected}
                            families={styles.families}
                            themeCount={styles.themeCount}
                            editable={!readOnly}
                            banners={banners}
                            variant={variant}
                            onVariantChange={setVariant}
                            error={(field, platform) => editor.fieldError(selected, field, platform)}
                            onChange={(change) => editor.edit(selected, change)}
                            onOpenComponent={(name) =>
                                navigate(
                                    `../components/${name}${context.versionId ? `?versionId=${encodeURIComponent(context.versionId)}` : ''}`,
                                )
                            }
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
                            variant={variant}
                            onSelect={selectStyle}
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
