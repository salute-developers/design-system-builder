/**
 * Правила вывода типа значения свойства.
 *
 * Вынесены отдельно, потому что ими пользуются обе читающие ручки — выгрузка пакета
 * и `GET /ds/component-config`. Вторая копия правила означала бы, что одно и то же
 * хранимое значение может вернуться с разным типом в зависимости от того, кто спросил.
 */

/**
 * Семейство paint: слот и виды заливки, которые он принимает.
 *
 * `properties.type` описывает слот API компонента, и `color` там покрывает семейство
 * целиком — KSP в `plasma-android` относит к нему `Color`, `Brush` и `InteractiveColor`.
 * Какой заливкой оказалось конкретное значение, знает токен, на который оно ссылается.
 */
export const PAINT_TYPES = new Set(["color", "gradient"]);

/** Типы, значение которых в общем формате записано числом, а не строкой. */
const NUMERIC_TYPES = new Set(["dimension", "float", "integer"]);

/**
 * Выводит вид заливки значения по его токену, с фолбэком на тип слота.
 *
 * Правило применяется к каждой строке значения отдельно: инвариант, значение вариации,
 * кросс-осевое сочетание и переопределение состояния выводят тип каждый по своему токену.
 */
export const deriveValueType = (propertyType: string, tokenType: string | null): string =>
  tokenType === "gradient" ? "gradient" : propertyType;

/**
 * Признак того, что вид заливки восстановить нечем: значение paint-слота не сослалось
 * на существующий токен, и отдан фолбэк на тип слота.
 *
 * В paint-слоте литералов не бывает: импорт трактует значение цветового свойства как имя
 * токена, поэтому неразрешённая ссылка — это либо опечатка в конфигурации, либо токен,
 * которого в дизайн-системе нет.
 */
export const isUnderivedPaint = (propertyType: string, tokenType: string | null): boolean =>
  PAINT_TYPES.has(propertyType) && !tokenType;

/**
 * Возвращает значению его исходный JSON-тип.
 *
 * В базе всё лежит текстом: импорт сериализует число в строку. Обратное преобразование
 * ведётся по типу значения, а не угадыванием: литерал `value` вида `"none"` числом
 * не является, а `"16"` у `dimension` — является.
 */
export const restoreJsonType = (raw: string | null, type: string): unknown => {
  if (raw === null) return null;

  if (NUMERIC_TYPES.has(type)) {
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? raw : parsed;
  }

  if (type === "boolean") {
    if (raw === "true") return true;
    if (raw === "false") return false;
  }

  return raw;
};

/**
 * Кладёт значение в поле, которое ждёт модель плагина: `default` у цвета и градиента,
 * `value` у остальных типов. Разделение строго по типу и на корпусе исключений не имеет.
 */
export const placeValue = (type: string, raw: unknown): Record<string, unknown> =>
  PAINT_TYPES.has(type) ? { default: raw } : { value: raw };
