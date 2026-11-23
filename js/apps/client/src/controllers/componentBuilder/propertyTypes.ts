import type { PropType } from './type';

/** Числовые свойства Core. `value` хранит произвольный CSS или enum и сюда не входит. */
export const numericPropertyTypes: ReadonlySet<PropType | undefined> = new Set(['dimension', 'float', 'integer']);

/** Числа без размерности: строка такого значения не является ссылкой на токен темы. */
export const unitlessNumericPropertyTypes: ReadonlySet<PropType | undefined> = new Set(['float', 'integer']);
