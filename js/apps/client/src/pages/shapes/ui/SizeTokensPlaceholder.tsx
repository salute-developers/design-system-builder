import { useState, type CSSProperties } from 'react';

import { PanelSkeleton, readWidths, TreeHeader, WorkspaceLoadError } from '../../../components/tokenWorkspace';
import { SIZES_TITLE } from './SizeTokenTree';

/** Ключ ширин панелей раздела: общий для экрана и его заглушек загрузки. */
export const SIZES_PANELS_KEY = 'ds_size_tokens_panels';

/** Ширины панелей, запомненные экраном: заглушка загрузки стоит на месте экрана без сдвига. */
const storedWidths = (): CSSProperties => {
    const { left, right } = readWidths(SIZES_PANELS_KEY);
    return { '--panel-left': `${left}px`, '--panel-right': `${right}px` } as CSSProperties;
};

/**
 * Загрузка и ошибка загрузки раздела (`Foundation/WorkspaceState`): шапка дерева на месте, тела панелей — скелетоны;
 * при ошибке рабочая область и инспектор показывают «Не удалось загрузить…» и «Повторить», без текста исключения.
 */
export const SizeTokensPlaceholder = ({ failed = false, onRetry }: { failed?: boolean; onRetry?: () => void }) => {
    const [searchOpen, setSearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    return (
        <div className="size-tokens-screen st-shell" data-testid="size-tokens-loading" aria-busy={!failed}>
            <section className="st-workbench is-placeholder" style={storedWidths()}>
                <aside className="token-browser st-tree">
                    <TreeHeader
                        title={SIZES_TITLE}
                        searching={searchOpen}
                        query={query}
                        onQuery={setQuery}
                        onSearchOpen={setSearchOpen}
                    />
                    <div className="st-tree-body">{!failed && <PanelSkeleton part="tree" />}</div>
                </aside>
                {failed ? (
                    <div className="st-load-error">
                        <WorkspaceLoadError title="Не удалось загрузить отступы, радиусы и тени" onRetry={onRetry} />
                    </div>
                ) : (
                    <>
                        <main className="preview-canvas">
                            <PanelSkeleton part="workspace" />
                        </main>
                        <aside className="properties-panel">
                            <PanelSkeleton part="inspector" />
                        </aside>
                    </>
                )}
            </section>
        </div>
    );
};
