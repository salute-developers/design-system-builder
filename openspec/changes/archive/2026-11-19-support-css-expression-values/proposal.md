## Why

У части числовых свойств значение — не число: `auto` у Chip `width`, `initial` у Switch `descriptionMaxLines`.
Инспектор показывает их в числовом поле с «px» («auto px») и не даёт ввести снова: ввод не разбирается как число
и молча откатывается. Свойства типа `value` (сырой CSS, например `statusLeft` у Avatar и `maxWidth` у Toast)
инспектор по-прежнему не показывает. Значения `value` у Avatar и ButtonGroup содержат шаблон ядра
`calc(var(${avatarTokens.avatarSize}) …)`, и web-плагин превью
передаёт такое значение в CSS как есть, и шаблон `${avatarTokens.avatarSize}` делает CSS недействительным — браузер
отбрасывает значение, значок статуса Avatar встаёт на место по умолчанию.

## What Changes

- Свойства типа `value` (сырой CSS: `avatarSize`, `statusLeft`, `maxWidth` у Toast) показываются в инспекторе
  текстовым полем без единиц и сохраняются строкой как введены. Раньше они не показывались вовсе.
- Числовое поле инспектора принимает и CSS-выражение: число по-прежнему пишется числом с единицей `px`, любое
  другое непустое значение — строкой как есть, без единицы.
- Web-плагин превью заменяет в значениях шаблоны ядра `${<объект>Tokens.<ключ>}` на имя CSS-переменной ядра, как
  при генерации пакета. Версия плагина поднимается.

## Capabilities

### New Capabilities

### Modified Capabilities
- `component-editor-workbench`: числовое поле принимает CSS-выражения; свойства `value` показываются и правятся.
- `component-preview-composition`: свойства `value` редактируются в панели свойств.
- `web-preview-plugin`: шаблоны токенов ядра в значениях разрешаются в имена CSS-переменных.

## Impact

- `js/apps/client`: `features/InspectorControls/NumberControl.tsx`, `InspectorPropertyRow.tsx`, тесты.
- `js/apps/preview-web-plugin`: `src/resolve/properties.ts`, `src/cssVariables.ts`, тесты, `package.json` и
  `package-lock.json` (версия).
- `backend-kt`, `frontend-kt`, `js/cli`: не затрагиваются.
