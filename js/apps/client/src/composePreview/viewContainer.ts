/**
 * Вид контейнера превью — логика `ViewContainer` plasma: внутри `onDark`/`onLight` цветовые токены `default`
 * и `inverse` берут значения токенов `on-dark`/`on-light` (у фонов — `dark`/`light`), как CSS-переменные
 * `viewContainer.dark|light` из `@salutejs/plasma-themes`.
 */
export type PreviewView = 'default' | 'onDark' | 'onLight';

export const PREVIEW_VIEWS: PreviewView[] = ['default', 'onDark', 'onLight'];

const opposite = (category: string, side: 'dark' | 'light') => (category === 'background' ? side : `on-${side}`);

/**
 * Токен, значение которого показывается вместо `id` в виде `view`: `dark.text.default.primary` в `onDark` —
 * `dark.text.on-dark.primary`. Токены других подкатегорий и не цвета остаются собой.
 */
export const viewTokenId = (id: string, view: PreviewView) => {
    if (view === 'default') return id;
    const [mode, category, subcategory, ...name] = id.split('.');
    if (!category || !name.length || (subcategory !== 'default' && subcategory !== 'inverse')) return id;
    const [main, other] = view === 'onDark' ? (['dark', 'light'] as const) : (['light', 'dark'] as const);
    const side = subcategory === 'default' ? main : other;
    return [mode, category, opposite(category, side), ...name].join('.');
};

/** Подменяет значения цветов и градиентов по {@link viewTokenId}; токен без пары сохраняет своё значение. */
export const applyPreviewView = <T extends { id: string; type: string; values: unknown }>(
    tokens: T[],
    view: PreviewView,
): T[] => {
    if (view === 'default') return tokens;
    const byId = new Map(tokens.map((token) => [token.id, token]));
    return tokens.map((token) => {
        if (token.type !== 'color' && token.type !== 'gradient') return token;
        const source = byId.get(viewTokenId(token.id, view));
        return source && source !== token && source.type === token.type ? { ...token, values: source.values } : token;
    });
};
