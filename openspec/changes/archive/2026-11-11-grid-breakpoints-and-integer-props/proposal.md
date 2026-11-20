## Why

Grid в сгенерированном пакете и в превью не работает: вид сетки в sdds-serv строится функцией ядра `getBaseGridView` по ширинам точек перелома (медиазапросы с числом колонок, отступами и шириной колонок), а импорт переносит в ДС только переменные, без этой функции. Число колонок (`*ColsCount`) хранится в базе типом `integer`, который не понимают ни клиент, ни генератор, поэтому значения не доходят ни до превью, ни до пакета. Подписи свойств с одиночной заглавной буквой (`largeLMinWidth`) в панели выглядят как «Large lMin width».

## What Changes

- Манифест генератора получает `breakpointView: { function, paramSuffix }`: генератор вставляет в стиль вызов функции ядра со значениями web-параметров этого стиля, оканчивающихся на `paramSuffix`, как sdds-serv (`getBaseGridView({ [gridTokens.smallMMinWidth]: '0rem', … }, 'default')`). Манифест Grid задаёт `getBaseGridView` и `MinWidth`.
- Тип свойства `integer` поддерживается в генераторе (значение пишется числом) и в клиенте (панель свойств и превью — как число).
- Подписи свойств и вариаций в инспекторе разбивают слова так же, как `camelToKebab`, и сохраняют заглавные сокращения: `largeLMinWidth` → «Large L min width».
- Стори Grid в web-плагине строит вид сетки той же функцией из ширин точек перелома сцены.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `generator-component-manifest`: вид по точкам перелома (`breakpointView`), тип `integer` в конфиге.
- `component-editor-workbench`: свойство `integer` в панели и превью, подписи свойств.

## Impact

- **js**: `js/cli/src/generator` (манифест, `createComponentConfig`, свойство `integer`), манифест `templates/Grid/component.json`; `js/apps/client` (типы и фабрика свойств, сборка превью, панель, `humanizeName`); `js/apps/preview-web-plugin` (стори Grid); тесты.
- **backend-kt**, **frontend-kt**: без изменений; `integer` уже есть в перечислении типов свойств ds-service.
