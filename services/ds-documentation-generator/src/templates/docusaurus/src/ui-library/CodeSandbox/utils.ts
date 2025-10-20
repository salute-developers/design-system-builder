/**
 * Mock реализация useComponentProps для CodeSandbox
 * В реальной документации этот хук получает данные из React Context
 */
export const USE_COMPONENT_PROPS_MOCK = `
import data from '../data/DATA.json';

export function useComponentProps() {
  return data || { viewList: {}, sizeList: [] };
}
`.trim();

/**
 * Проверяет, нужно ли добавлять импорт useComponentProps
 */
const shouldAddImport = (source: string): boolean => {
  // Проверяем, используется ли useComponentProps в коде
  if (!source.includes("useComponentProps")) {
    return false;
  }

  // Проверяем, есть ли уже импорт useComponentProps
  if (
    source.includes("from './hooks/useComponentProps'") ||
    source.includes('from "./hooks/useComponentProps"')
  ) {
    return false;
  }

  return true;
};

/**
 * Находит индекс для вставки нового импорта
 * Возвращает индекс строки после последнего импорта
 */
const findImportInsertIndex = (lines: string[]): number => {
  let lastImportIndex = -1;

  // Ищем последний import
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("import ")) {
      lastImportIndex = i;
    }

    // Прекращаем поиск после первой не-импорт строки (кроме пустых и комментариев)
    if (
      line &&
      !line.startsWith("import ") &&
      !line.startsWith("//") &&
      !line.startsWith("/*")
    ) {
      break;
    }
  }

  // Вставляем после последнего import или в начало файла
  return lastImportIndex >= 0 ? lastImportIndex + 1 : 0;
};

/**
 * Добавляет импорт useComponentProps в код, если он используется
 *
 * @param source - исходный код
 * @returns трансформированный код с добавленным импортом
 *
 * @example
 * ```ts
 * const code = `
 * import React from 'react';
 *
 * export function App() {
 *   const { viewList } = useComponentProps();
 *   return <div>...</div>;
 * }
 * `;
 *
 * const transformed = addUseComponentPropsImport(code);
 * // Результат:
 * // import React from 'react';
 * // import { useComponentProps } from './hooks/useComponentProps';
 * //
 * // export function App() { ... }
 * ```
 */
export const addUseComponentPropsImport = (source: string): string => {
  if (!shouldAddImport(source)) {
    return source;
  }

  const lines = source.split("\n");
  const insertIndex = findImportInsertIndex(lines);
  const importStatement =
    "import { useComponentProps } from './hooks/useComponentProps';";

  lines.splice(insertIndex, 0, importStatement);

  return lines.join("\n");
};
