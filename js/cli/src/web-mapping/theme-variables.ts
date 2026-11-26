/**
 * Имя CSS-переменной цветового токена темы по категории, подкатегории и имени: `--<категория>-<имя>` для подкатегории
 * `default`, иначе `--<подкатегория>-<категория>-<имя>` (`text.default.primary` → `--text-primary`,
 * `surface.on-dark.solid-default` → `--on-dark-surface-solid-default`).
 */
export const colorVariableName = (category: string, subcategory: string, name: string): string =>
    [subcategory === 'default' ? '-' : `--${subcategory}`, category, name].join('-');

/** Суффикс производного токена темы для состояния: `<токен>-hover` при наведении, `<токен>-active` при нажатии. */
export const DERIVED_STATE_TOKEN_SUFFIX: Readonly<Record<string, string>> = { hovered: '-hover', pressed: '-active' };
