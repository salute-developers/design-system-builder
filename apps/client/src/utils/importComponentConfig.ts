import type { Config, Theme } from '../controllers';
import type { ComponentAPI, ComponentVariation, PropType } from '../controllers/componentBuilder/type';

/**
 * Импорт значений токенов из plasma-конфигов компонентов.
 *
 * Источник — файл вида
 *   packages/sdds-serv/src/components/<Component>/<Component>.config.ts
 *
 * config.ts описывает вариации в формате:
 *   variations: {
 *       view: { default: css`${badgeTokens.background}: var(--surface-solid-default);` },
 *       size: { m: css`${badgeTokens.height}: 1.5rem;` },
 *   }
 *
 * Сопоставление с нашими данными:
 *   - вариация и стиль матчатся по имени (регистронезависимо): наша вариация
 *     `view`/`size` ↔ ключ в config.variations; наш стиль `Default`/`M` ↔ ключ
 *     внутри (`default`/`m`);
 *   - проп матчится по web-токену: имя web-токена нашего пропа РАВНО ключу
 *     токена в config.ts (`${badgeTokens.background}` -> `background`).
 *     Для типографики у пропа несколько web-токенов (`fontSize`, `fontFamily`…),
 *     совпадение по любому из них даёт значение типографики.
 */

export interface ParsedConfig {
    /** variationName -> styleName -> tokenKey -> rawValue */
    variations: Record<string, Record<string, Record<string, string>>>;
}

const RAW_GITHUB_BASE = 'https://raw.githubusercontent.com/salute-developers/plasma/dev/packages';

/** Конфиг может иметь как `.ts`, так и `.tsx` расширение. */
export const getConfigUrls = (componentName: string) =>
    ['ts', 'tsx'].map(
        (ext) => `${RAW_GITHUB_BASE}/sdds-serv/src/components/${componentName}/${componentName}.config.${ext}`,
    );

/**
 * Парсит `<Component>.config.ts` в структуру вариаций.
 *
 * Внутри `variations` каждый ключ верхнего уровня — это имя вариации, его
 * значение — объект стилей, а каждый стиль это css-шаблон со строками
 * `${xxxTokens.tokenKey}: value;`.
 */
export const parseConfigFile = (source: string): ParsedConfig => {
    const variations: ParsedConfig['variations'] = {};

    const variationsStart = source.search(/variations\s*:\s*{/);

    if (variationsStart === -1) {
        return { variations };
    }

    const variationsBody = extractBalancedBlock(source, source.indexOf('{', variationsStart));

    if (!variationsBody) {
        return { variations };
    }

    // Каждая вариация: `name: { ... }`
    for (const { key: variationName, body: variationBody } of iterateBlocks(variationsBody)) {
        const styles: Record<string, Record<string, string>> = {};

        // Каждый стиль: `styleName: css\`...\``
        for (const { key: styleName, body: styleBody } of iterateCssBlocks(variationBody)) {
            styles[styleName.toLowerCase()] = parseCssTokens(styleBody);
        }

        if (Object.keys(styles).length) {
            variations[variationName.toLowerCase()] = styles;
        }
    }

    return { variations };
};

/** Достаёт строки `${xxxTokens.tokenKey}: value;` из тела css-шаблона. */
const parseCssTokens = (cssBody: string): Record<string, string> => {
    const tokens: Record<string, string> = {};

    const lineRegex = /\$\{[a-zA-Z0-9_]+\.([a-zA-Z0-9_]+)\}\s*:\s*([^;]+);/g;

    let match: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((match = lineRegex.exec(cssBody)) !== null) {
        const [, tokenKey, rawValue] = match;
        tokens[tokenKey] = rawValue.trim();
    }

    return tokens;
};

/**
 * Возвращает содержимое сбалансированного `{...}` блока, начиная с индекса
 * открывающей скобки (исключая сами скобки).
 */
const extractBalancedBlock = (source: string, openIndex: number): string | null => {
    if (source[openIndex] !== '{') {
        return null;
    }

    let depth = 0;

    for (let i = openIndex; i < source.length; i++) {
        const char = source[i];

        if (char === '{') {
            depth++;
        } else if (char === '}') {
            depth--;

            if (depth === 0) {
                return source.slice(openIndex + 1, i);
            }
        }
    }

    return null;
};

/** Итерирует записи `key: { ... }` верхнего уровня внутри тела объекта. */
function* iterateBlocks(body: string): Generator<{ key: string; body: string }> {
    const keyRegex = /([a-zA-Z0-9_]+)\s*:\s*{/g;

    let match: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((match = keyRegex.exec(body)) !== null) {
        const key = match[1];
        const openIndex = body.indexOf('{', match.index);
        const inner = extractBalancedBlock(body, openIndex);

        if (inner === null) {
            continue;
        }

        yield { key, body: inner };

        // продолжаем после закрытия блока
        keyRegex.lastIndex = openIndex + inner.length + 2;
    }
}

/** Итерирует записи `key: css\`...\`` внутри тела объекта вариации. */
function* iterateCssBlocks(body: string): Generator<{ key: string; body: string }> {
    const keyRegex = /([a-zA-Z0-9_]+)\s*:\s*css`/g;

    let match: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((match = keyRegex.exec(body)) !== null) {
        const key = match[1];
        const openIndex = body.indexOf('`', keyRegex.lastIndex - 1);
        const closeIndex = body.indexOf('`', openIndex + 1);

        if (closeIndex === -1) {
            continue;
        }

        yield { key, body: body.slice(openIndex + 1, closeIndex) };

        keyRegex.lastIndex = closeIndex + 1;
    }
}

/**
 * Нормализует "сложное" значение размера: берёт первое непустое (ненулевое)
 * значение, напр. `0 0.6875rem` -> `0.6875rem`, `0 0 24px 0` -> `24px`.
 * Если все значения нулевые — берёт первое. Возвращает число в пикселях
 * (наша модель хранит dimension как число px).
 */
const parseDimensionValue = (raw: string): number | undefined => {
    const parts = raw.trim().split(/\s+/).filter(Boolean);

    if (!parts.length) {
        return undefined;
    }

    const toPx = (token: string): number | undefined => {
        const numeric = parseFloat(token);

        if (Number.isNaN(numeric)) {
            return undefined;
        }

        return token.endsWith('rem') ? numeric * 16 : numeric;
    };

    // первое ненулевое значение, иначе первое
    const meaningful = parts.find((token) => {
        const px = toPx(token);

        return px !== undefined && px !== 0;
    });

    return toPx(meaningful ?? parts[0]);
};

/** Извлекает имя CSS-переменной из `var(--x)`. */
const extractCssVar = (raw: string): string | undefined => {
    const match = raw.match(/var\(\s*(--[^)\s,]+)/);

    return match ? match[1] : undefined;
};

/**
 * Строит обратную карту: CSS-переменная цвета -> наш токен цвета (dot-path),
 * используя тот же алгоритм, что `ColorProp.getCSSVar`.
 */
const buildColorVarMap = (theme: Theme): Map<string, string> => {
    const map = new Map<string, string>();

    theme
        .getTokens('color')
        .filter((item) => item.getEnabled() && item.getTags()[0] === 'dark')
        .forEach((item) => {
            const [, ...rest] = item.getName().split('.');
            const tokenName = rest.join('.');

            const cssVar = colorTokenToCssVar(tokenName);

            if (cssVar && !map.has(cssVar)) {
                map.set(cssVar, tokenName);
            }
        });

    return map;
};

/** Повторяет `ColorProp.getCSSVar`: `text.default.primary` -> `--text-primary`. */
const colorTokenToCssVar = (value: string): string | undefined => {
    const [category, subcategory, name] = value.split('.');

    if (!category) {
        return undefined;
    }

    return [subcategory === 'default' ? '-' : `--${subcategory}`, category, name].filter(Boolean).join('-');
};

/**
 * Строит карту: значение border-radius (`0.375rem`) -> наш shape-токен
 * (`round.xs`), по токенам формы текущей темы.
 */
const buildShapeValueMap = (theme: Theme): Map<string, string> => {
    const map = new Map<string, string>();

    (theme.getTokens('shape') || [])
        .filter((item) => item.getEnabled() && item.getTags()[0] === 'round')
        .forEach((item) => {
            const value = item.getValue('web');

            if (value && !map.has(value)) {
                map.set(value, item.getName());
            }
        });

    return map;
};

// Известные начертания, которые могут присутствовать сегментом в CSS-переменной.
const TYPOGRAPHY_WEIGHTS = ['bold', 'medium', 'normal'];

/**
 * Обратное преобразование типографики из CSS-переменной в имя нашего токена
 * (`body.s.normal`). Начертание берётся из переменной, если оно там есть
 * (`--plasma-typo-body-l-bold-font-weight` -> `body.l.bold`), иначе `normal`.
 */
const parseTypographyValue = (raw: string, typographyNames: Set<string>): string | undefined => {
    const cssVar = extractCssVar(raw);

    if (!cssVar) {
        return undefined;
    }

    // --plasma-typo-body-l-bold-font-weight -> body-l-bold
    const match = cssVar.match(/--plasma-typo-(.+?)-(?:font|letter|line)/);

    if (!match) {
        return undefined;
    }

    const nameMapReverse: Record<string, string> = {
        dspl: 'display',
        text: 'text',
        body: 'body',
    };

    const parts = match[1].split('-');
    parts[0] = nameMapReverse[parts[0]] || parts[0];

    // Если последний сегмент — известное начертание, выделяем его; иначе normal.
    const last = parts[parts.length - 1];
    const weight = TYPOGRAPHY_WEIGHTS.includes(last) ? parts.pop()! : 'normal';

    const base = parts.join('.');
    const preferred = `${base}.${weight}`;

    if (typographyNames.has(preferred)) {
        return preferred;
    }

    // Фолбэк: запрошенное начертание недоступно — берём normal или любое для размера.
    if (typographyNames.has(`${base}.normal`)) {
        return `${base}.normal`;
    }

    return [...typographyNames].find((name) => name.startsWith(`${base}.`));
};

/** Имена доступных типографических токенов без сегмента экрана (`body.s.normal`). */
const buildTypographyNames = (theme: Theme): Set<string> => {
    const names = new Set<string>();

    theme
        .getTokens('typography')
        .filter((item) => item.getEnabled() && item.getTags()[0] === 'screen-s')
        .forEach((item) => {
            const [, ...rest] = item.getName().split('.');

            names.add(rest.join('.'));
        });

    return names;
};

export interface ApplyConfigResult {
    /** Сколько значений токенов проставлено. */
    applied: number;
    /** Имена вариаций config.ts, для которых не нашлось совпадения у нас. */
    unmatchedVariations: string[];
    /** Диагностика сопоставления. */
    debug: ImportDebug;
}

export interface ImportDebug {
    componentName: string;
    parsedVariations: string[];
    ourVariations: string[];
    misses: Array<{ variation: string; style: string; prop: string; reason: string }>;
    hits: Array<{ variation: string; style: string; prop: string; raw: string; value: string | number }>;
}

/**
 * Выгружает `config.ts` компонента из репозитория plasma и применяет значения
 * к текущему `Config`.
 */
export const importComponentConfigFromPlasma = async (
    config: Config,
    api: ComponentAPI[],
    variations: ComponentVariation[],
    theme: Theme,
): Promise<ApplyConfigResult> => {
    const componentName = upperFirst(config.getName());

    const configSource = await fetchConfigSource(getConfigUrls(componentName));
    const parsed = parseConfigFile(configSource);

    return applyConfigToComponent(config, api, variations, theme, parsed);
};

/** Пробует загрузить конфиг по списку URL (.ts, затем .tsx), возвращает первый успешный. */
const fetchConfigSource = async (urls: string[]): Promise<string> => {
    for (const url of urls) {
        const response = await fetch(url);

        if (response.ok) {
            return response.text();
        }
    }

    throw new Error(`Не удалось загрузить конфиг: ${urls.join(', ')}`);
};

const upperFirst = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

/**
 * Применяет распарсенный конфиг к нашему `Config`, мутируя значения токенов.
 *
 * Идёт от токенов API вариации (а не от уже добавленных в стиль пропов), чтобы
 * проставлять значения даже у стилей, в которых пропы ещё не заведены.
 */
export const applyConfigToComponent = (
    config: Config,
    api: ComponentAPI[],
    variations: ComponentVariation[],
    theme: Theme,
    parsed: ParsedConfig,
): ApplyConfigResult => {
    const colorVarMap = buildColorVarMap(theme);
    const shapeValueMap = buildShapeValueMap(theme);
    const typographyNames = buildTypographyNames(theme);

    let applied = 0;
    const matchedVariationNames = new Set<string>();
    const debug: ImportDebug = {
        componentName: upperFirst(config.getName()),
        parsedVariations: Object.keys(parsed.variations),
        ourVariations: config.getVariations().map((v) => v.getName()),
        misses: [],
        hits: [],
    };

    config.getVariations().forEach((variation) => {
        const variationName = variation.getName().toLowerCase();
        const parsedStyles = parsed.variations[variationName];

        if (!parsedStyles) {
            return;
        }

        matchedVariationNames.add(variationName);

        // Пропы (токены API), доступные для этой вариации.
        const variationProps = getApiPropsForVariation(api, variations, variation.getID());

        // Идём по стилям из конфига: отсутствующие у нас — создаём.
        Object.entries(parsedStyles).forEach(([styleName, tokenValues]) => {
            let style = variation.getStyles()?.find((item) => item.getName().toLowerCase() === styleName);

            if (!style) {
                style = variation.addStyle(styleName, api);
            }

            variationProps.forEach((apiProp) => {
                const rawValue = findRawValueForProp(apiProp, tokenValues);

                if (rawValue === undefined) {
                    debug.misses.push({
                        variation: variation.getName(),
                        style: style.getName(),
                        prop: apiProp.name,
                        reason: 'нет значения в config.ts',
                    });

                    return;
                }

                const value = convertValue(apiProp.type, rawValue, colorVarMap, shapeValueMap, typographyNames);

                if (value === undefined) {
                    debug.misses.push({
                        variation: variation.getName(),
                        style: style.getName(),
                        prop: apiProp.name,
                        reason: `не сконвертировалось: "${rawValue}"`,
                    });

                    return;
                }

                // Проп мог быть не добавлен в стиль — добавляем, если его нет.
                const existing = style.getProps().getProp(apiProp.id);

                if (existing) {
                    config.updateToken(apiProp.id, value, variation.getID(), style.getID());
                } else {
                    config.addToken(apiProp.id, value, api, variation.getID(), style.getID());
                }

                debug.hits.push({
                    variation: variation.getName(),
                    style: style.getName(),
                    prop: apiProp.name,
                    raw: rawValue,
                    value,
                });

                applied++;
            });
        });
    });

    const unmatchedVariations = Object.keys(parsed.variations).filter((name) => !matchedVariationNames.has(name));

    return { applied, unmatchedVariations, debug };
};

/** Пропы (токены API), доступные для вариации (см. getPropsByVariation). */
const getApiPropsForVariation = (
    api: ComponentAPI[],
    variations: ComponentVariation[],
    variationID: string,
): ComponentAPI[] => {
    const id = variations.find((variation) => variation.id === variationID)?.id || '';

    return api.filter((item) => item.variations?.some((v) => v === id));
};

/**
 * Находит plasma-значение для пропа: имя web-токена пропа равно ключу токена в
 * config.ts. У типографики несколько web-токенов — предпочитаем `fontWeight`,
 * так как только в его CSS-переменной закодировано начертание
 * (`--plasma-typo-body-l-bold-font-weight`).
 */
const findRawValueForProp = (apiProp: ComponentAPI, tokenValues: Record<string, string>): string | undefined => {
    const webTokens = apiProp.platformMappings?.web;

    if (!webTokens?.length) {
        return undefined;
    }

    if (apiProp.type === 'typography') {
        const weightToken = webTokens.find(({ name }) => name.toLowerCase().includes('weight'));

        if (weightToken && tokenValues[weightToken.name] !== undefined) {
            return tokenValues[weightToken.name];
        }
    }

    for (const { name } of webTokens) {
        if (tokenValues[name] !== undefined) {
            return tokenValues[name];
        }
    }

    return undefined;
};

/** Конвертирует plasma-значение в наше хранимое значение по типу пропа. */
const convertValue = (
    type: PropType,
    rawValue: string,
    colorVarMap: Map<string, string>,
    shapeValueMap: Map<string, string>,
    typographyNames: Set<string>,
): string | number | undefined => {
    if (type === 'color') {
        const cssVar = extractCssVar(rawValue);

        if (!cssVar) {
            return undefined;
        }

        return colorVarMap.get(cssVar);
    }

    if (type === 'typography') {
        return parseTypographyValue(rawValue, typographyNames);
    }

    if (type === 'dimension') {
        return parseDimensionValue(rawValue);
    }

    if (type === 'float') {
        const numeric = parseFloat(rawValue);

        return Number.isNaN(numeric) ? undefined : numeric;
    }

    if (type === 'shape') {
        // plasma отдаёт сырой rem (`0.375rem`) — ищем shape-токен темы по значению.
        return shapeValueMap.get(rawValue.trim());
    }

    return undefined;
};
