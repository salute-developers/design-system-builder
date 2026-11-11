## Контекст

`StyleReferenceProp` хранит значение как строку `basic-button.xxs.default`; `resolveStyleReference`
разворачивает её в конфигурацию целевого компонента и выбранные стили по осям (используется превью).
Запись правок в `componentRepository` отправляет значение свойства как `tokenId`/`value`/`adjustment`
в `invariant-/variation-property-values` и ссылок не знает. Операция `PUT /api/ds/appearances/{id}/property-values`
с `reference` уже реализована в `ds-service`.

## Цели / Вне целей

**Цели:** выбор оформления и стилей в панели свойств; запись через существующую операцию; понятные
ошибки проверки.

**Вне целей:** изменения `ds-service`, `frontend-kt`, превью; редактирование ссылок у значений с
наборами состояний сверх того, что даёт общая панель свойств.

## Решения

1. **Каскад выборов.** Выбор оформления целевого компонента, затем по одному выбору на ось. Состояние
   выбора получается из строки существующим `resolveStyleReference` (общая логика с превью), а строка
   собирается обратно в порядке осей оформления. Альтернатива — плоский список всех сочетаний:
   отвергнута из-за комбинаторного роста.
2. **Источник данных.** Список оформлений и их оси берутся из уже загруженных `composeComponentsData`
   дизайн-системы, без новых запросов.
3. **Запись.** В `PropertyChange` добавляется необязательное поле `reference` (идентификатор целевого
   оформления и идентификаторы стилей). `componentRepository` для изменений с `reference` вызывает
   `PUT /api/ds/appearances/{id}/property-values`, остальные изменения идут прежним путём. Удаление
   использует существующую операцию удаления значения.
4. **Ошибки.** Коды `reference_*` из ответа `422` сопоставляются с сообщениями в существующем
   механизме показа ошибок автосохранения.

```mermaid
flowchart LR
    S[Выбор в панели свойств] -->|строка оформление.стиль| P[StyleReferenceProp]
    P --> C[Превью: resolveStyleReference]
    P -->|PropertyChange с reference| R[componentRepository]
    R -->|PUT property-values| D[ds-service]
```

## Программное проектирование

```ts
interface StyleReferenceChange { targetAppearanceId: string; styleIds: string[] }
interface PropertyChange { /* ... */ reference?: StyleReferenceChange }
const buildStyleReference: (components: Meta[], appearanceId: string, selections: Record<string, string>) =>
    { value: string; reference: StyleReferenceChange } | undefined;
```

## Риски / Компромиссы

- Строка значения и `reference` должны оставаться согласованными: сервер пересобирает текст из
  действующих имён, клиент сверяет значение после ответа.
- Неочевидно, как автосохранение выделяет изменения значения с состояниями; покрывается тестами.
