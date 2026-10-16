import type { ColorTokenView, ContrastPair } from '../../../modules/colorTokens';

interface AccessibilityPanelProps {
    view: ColorTokenView | null;
    pairs: ContrastPair[];
    colorOf: (themeName: string) => string;
    displayName: (token: string) => string;
    onOpenComponent: (pair: ContrastPair) => void;
}

const LIMIT = 40;

/** Вкладка «Доступность» по `themePreview` прототипа: пары контраста выбранного токена в компонентах. */
export const AccessibilityPanel = ({ view, pairs, colorOf, displayName, onOpenComponent }: AccessibilityPanelProps) => {
    const visible = pairs.slice(0, LIMIT);
    const failed = pairs.filter((pair) => !pair.pass).length;
    const components = new Set(pairs.map((pair) => pair.component)).size;
    const name = view?.displayName ?? 'Выбранный токен';
    return (
        <section className="accessibility-matrix" data-testid="accessibility-panel">
            <header>
                <div>
                    <strong>{name}</strong>
                    <span>
                        {pairs.length
                            ? `${pairs.length} пар · ${components} компонентов`
                            : 'Проверяются только фактические пары в компонентах'}
                    </span>
                </div>
                {!pairs.length ? (
                    <span className="is-empty">Нет данных</span>
                ) : failed ? (
                    <span className="is-bad">
                        {failed} {failed === 1 ? 'ошибка' : 'ошибок'}
                    </span>
                ) : (
                    <span className="is-ok">Все пары прошли</span>
                )}
            </header>
            <div className="accessibility-pair-list">
                {visible.map((pair, index) => (
                    <article key={index} className={pair.pass ? 'is-pass' : 'is-fail'}>
                        <div
                            className="accessibility-pair-preview"
                            style={{
                                background: colorOf(`${pair.mode}.${pair.backgroundToken}`),
                                color: colorOf(`${pair.mode}.${pair.foregroundToken}`),
                            }}
                        >
                            <span>Aa</span>
                        </div>
                        <div className="accessibility-pair-copy">
                            <strong>
                                {pair.component} · {pair.style} · {pair.state} ·{' '}
                                {pair.mode === 'dark' ? 'Dark' : 'Light'}
                            </strong>
                            <span>{displayName(pair.foregroundToken)}</span>
                            <span>на {displayName(pair.backgroundToken)}</span>
                        </div>
                        <div className="accessibility-pair-result">
                            <strong>{pair.ratio === null ? '—' : pair.ratio.toFixed(2)}</strong>
                            <span>{pair.pass ? `AA · ${pair.threshold}:1` : `Нужно ${pair.threshold}:1`}</span>
                            <button type="button" onClick={() => onOpenComponent(pair)}>
                                К компоненту
                            </button>
                        </div>
                    </article>
                ))}
                {!pairs.length && (
                    <div className="empty compact">
                        <strong>Нет проверяемых пар для этого токена</strong>
                        <p>
                            {name} пока не участвует в текстовых, иконочных или контурных парах компонентов. Это не
                            означает, что проверка пройдена.
                        </p>
                    </div>
                )}
                {pairs.length > visible.length && (
                    <div className="accessibility-pair-more">
                        Показаны первые {visible.length} из {pairs.length} пар
                    </div>
                )}
            </div>
        </section>
    );
};
