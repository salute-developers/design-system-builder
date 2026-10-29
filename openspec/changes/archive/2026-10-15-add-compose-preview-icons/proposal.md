## Why

В Compose-превью у компонентов с иконкой иконки нет: у `AccordionItem` не рисуется стрелка раскрытия. Иконки в данных
есть: у `AccordionItem` в базе лежат значения `closedIcon` и `openedIcon` (`disclosure.down.fill.16`, `plus.16` и другие),
а всего в Compose-конфигурациях дизайн-систем 26 разных имён. До плагина они не доходят по двум причинам:

- клиент отбрасывает свойства типа `icon` ещё при построении модели конфигурации (`getConfigToken` возвращает `null`
  для любого типа, кроме известных семи), поэтому в payload их нет;
- плагин всё равно пропускает свойства типа `icon`: генератор фабрик помечает их неподдерживаемыми, а SDK не умеет
  создавать `ImageSource` из значения payload.

В приложении стрелка берётся из стиля дизайн-системы: `iconClosed(imageVectorSource(SddsIcons.DisclosureDownFill16))`.
Иконки Compose-набора (`sdds-core:icons-compose`) уже в зависимостях плагина как `ImageVector`, поэтому достаточно
передавать в payload имя иконки, а плагину находить её по имени.

## What Changes

- Клиент понимает свойство типа `icon`: хранит его в модели конфигурации и передаёт в payload `literal`-строкой с именем,
  как оно записано в данных (`disclosure.down.fill.16`). Схема payload не меняется.
- Плагин приводит имя к члену `SddsIcons` (`DisclosureDownFill16`), находит иконку в реестре и строит `ImageSource`;
  неизвестное имя даёт предупреждение `unknown_icon`, а компонент рисуется без иконки.
- Редактор показывает значение иконки строкой только для чтения; выбор иконки вне объёма.

## Capabilities

### New Capabilities

- `compose-preview-icons`: передача иконки по имени из конфигурации компонента до отрисовки в плагине.

### Modified Capabilities

Нет (изменения плагина описаны в парном change `add-compose-preview-icons` в `plasma-android`).

## Impact

- `js/apps/client`: модель конфигурации (`controllers/componentBuilder`, тип `icon`), `composePreview/assembler.ts`, панель
  свойств, тесты.
- `backend-kt/preview/contract`: описание `icon` в `README.md`; JSON-схема payload не меняется.
- `plasma-android`: плагин (реестр иконок, генератор фабрик, SDK) — парный change.
- Данные менять не нужно: значения иконок уже в базе.
- Не входит: тени (`shadow`), выбор иконки в редакторе, растровые и произвольные SVG-иконки (путь через `assets`).
