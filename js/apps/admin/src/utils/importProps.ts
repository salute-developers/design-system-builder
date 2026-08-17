/**
 * Импорт web-токенов компонента из plasma-ядра.
 *
 * Источник — файл вида
 *   packages/plasma-new-hope/src/components/<Component>/<Component>.tokens.ts
 *
 * В нём экспортируется объект `tokens`, ключи которого — имена токенов
 * (`background`, `borderRadius`, `fontSize`…). Эти имена переносятся в
 * properties компонента как web-параметры «как есть».
 */

import type { components } from '../api/types.gen';

const RAW_GITHUB_BASE = 'https://raw.githubusercontent.com/salute-developers/plasma/dev/packages';

/** tokens.ts может иметь как `.ts`, так и `.tsx` расширение. */
export function getTokensUrls(componentName: string): string[] {
  return ['ts', 'tsx'].map(
    (ext) =>
      `${RAW_GITHUB_BASE}/plasma-new-hope/src/components/${componentName}/${componentName}.tokens.${ext}`,
  );
}

/**
 * Парсит `<Component>.tokens.ts` и возвращает ключи объекта `tokens`
 * (имена токенов слева).
 */
export function parseTokenNames(source: string): string[] {
  // Берём именно `export const tokens = { ... }`, а не `privateTokens`/`classes`.
  const match = source.match(/export const tokens\s*=\s*{([\s\S]*?)};/);

  if (!match) {
    return [];
  }

  const body = match[1];
  const names: string[] = [];
  // строки вида:  background: '--plasma-badge-background',
  const entryRegex = /([a-zA-Z0-9_]+)\s*:\s*['"`]--[^'"`]+['"`]/g;

  let entry: RegExpExecArray | null;
  while ((entry = entryRegex.exec(body)) !== null) {
    names.push(entry[1]);
  }

  return names;
}

/** Загружает tokens.ts (пробуя .ts, затем .tsx) и возвращает имена токенов. */
export async function fetchTokenNames(componentName: string): Promise<string[]> {
  const urls = getTokensUrls(componentName);

  for (const url of urls) {
    const response = await fetch(url);

    if (response.ok) {
      return parseTokenNames(await response.text());
    }
  }

  throw new Error(`Не удалось загрузить tokens.ts: ${urls.join(', ')}`);
}

/** Тип свойства — тот же, что отдаёт API; список ведётся в схеме БД. */
export type PropertyType = components['schemas']['Property']['type'];

/** Имя property + его тип + набор web-токенов (имён из tokens.ts). */
export interface ImportedProperty {
  name: string;
  type: PropertyType;
  webTokens: string[];
}

/**
 * Токены типографики, которые в нашей модели объединяются в один property
 * `textStyle` (тип `typography`) с шестью web-параметрами.
 */
const TYPOGRAPHY_TOKENS = [
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'letterSpacing',
  'lineHeight',
];

const TYPOGRAPHY_PROPERTY_NAME = 'textStyle';

/**
 * Эвристически определяет тип property по имени токена. tokens.ts не содержит
 * типов, поэтому угадываем по названию; при неоднозначности — `color`.
 */
export function inferPropertyType(tokenName: string): PropertyType {
  const name = tokenName.toLowerCase();

  if (name.includes('radius') || name === 'shape') {
    return 'shape';
  }

  if (name.includes('shadow')) {
    return 'shadow';
  }

  if (name.includes('opacity') || name.includes('alpha')) {
    return 'float';
  }

  if (
    name.includes('height') ||
    name.includes('width') ||
    name.includes('padding') ||
    name.includes('margin') ||
    name.includes('size') ||
    name.includes('gap') ||
    name.includes('offset') ||
    name.includes('indent')
  ) {
    return 'dimension';
  }

  if (name.includes('color') || name.includes('background') || name.includes('fill')) {
    return 'color';
  }

  return 'color';
}

/**
 * Токены состояний hover/active (`backgroundHover`, `colorActive`) НЕ создаются
 * отдельными property: hover/active обрабатываются движком состояний как states
 * базового пропа. Определяем по суффиксу в конце имени, чтобы не задеть базовые
 * токены вроде `focusColor`.
 */
function isStateToken(name: string): boolean {
  return /(?:Hover|Active)$/.test(name);
}

/**
 * Преобразует имена токенов из tokens.ts в список properties.
 *
 * Все типографические токены (fontFamily, fontSize, fontStyle, fontWeight,
 * letterSpacing, lineHeight) схлопываются в один property `textStyle` типа
 * `typography` с шестью web-параметрами. Токены состояний hover/active
 * игнорируются. Остальные токены — по одному property на токен; имя
 * web-параметра совпадает с именем токена.
 */
export function toImportedProperties(tokenNames: string[]): ImportedProperty[] {
  const result: ImportedProperty[] = [];
  const typographyTokens: string[] = [];

  for (const name of tokenNames) {
    if (isStateToken(name)) {
      continue;
    }

    if (TYPOGRAPHY_TOKENS.includes(name)) {
      typographyTokens.push(name);
      continue;
    }

    result.push({ name, type: inferPropertyType(name), webTokens: [name] });
  }

  if (typographyTokens.length) {
    result.push({
      name: TYPOGRAPHY_PROPERTY_NAME,
      type: 'typography',
      webTokens: typographyTokens,
    });
  }

  return result;
}
