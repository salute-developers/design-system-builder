/**
 * Mock реализация useMockComponentProps для CodeSandbox
 * В реальной документации этот хук получает данные из React Context
 */
export const USE_COMPONENT_PROPS_MOCK = `
import data from '../data/DATA.json';

export function useMockComponentProps() {
  return data || { viewList: {}, sizeList: [] };
}
`.trim();

/**
 * Проверяет, нужно ли добавлять импорт useMockComponentProps
 */
const shouldAddImport = (source: string): boolean => {
  // Проверяем, используется ли useMockComponentProps в коде
  if (!source.includes("useMockComponentProps")) {
    return false;
  }

  // Проверяем, есть ли уже импорт useMockComponentProps
  if (
    source.includes("from './hooks/useMockComponentProps'") ||
    source.includes('from "./hooks/useMockComponentProps"')
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
 * Добавляет импорт useMockComponentProps в код, если он используется
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
 *   const { viewList } = useMockComponentProps();
 *   return <div>...</div>;
 * }
 * `;
 *
 * const transformed = addUseComponentPropsImport(code);
 * // Результат:
 * // import React from 'react';
 * // import { useMockComponentProps } from './hooks/useMockComponentProps';
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
    "import { useMockComponentProps } from './hooks/useMockComponentProps';";

  lines.splice(insertIndex, 0, importStatement);

  return lines.join("\n");
};
