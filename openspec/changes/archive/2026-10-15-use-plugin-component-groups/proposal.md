## Why

Меню Compose-компонентов раскладывает их по группам по таблице `composeComponentGroups` в `utils/menuItems.ts`, которую
клиент ведёт вручную по web-каталогу. В Android-песочнице группа компонента задана в `ComponentKey` (`sandbox-core`), и у
10 компонентов из 79 группы расходятся: `CircularProgressBar`, `ProgressBar`, `Loader` в песочнице в «Data Display», в клиенте
в «Overlay»; `DropdownEmptyState`, `DropdownLoadingState`, `DropdownMenu`, `PaginationDots`, `ScrollBar`, `Splitter` тоже.
Пользователь не находит компонент там, где ищет его по песочнице. Источник правды — песочница, но клиент группу получить не
может: в api-мете её нет, а манифест плагина содержит только список имён.

## What Changes

- Манифест плагина `preview-plugin.json` получает необязательное поле `groups` (парный change
  `expose-component-groups-in-manifest` в `plasma-android`): список групп с именами компонентов, сформированный по реестру
  историй песочницы.
- Клиент читает `groups` из манифеста и раскладывает по ним Compose-компоненты в меню. Таблица `composeComponentGroups`
  остаётся запасной для плагина без `groups` и для компонентов, которых в манифесте нет.
- Порядок групп в меню не меняется: он по алфавиту, как у всех меню.

## Capabilities

### New Capabilities

- `compose-component-menu-groups`: группы Compose-компонентов в меню берутся из плагина.

### Modified Capabilities

Нет.

## Impact

- `js/apps/client`: `composePreview` (тип и разбор манифеста), `utils/menuItems.ts`, страница компонентов (`Components.tsx`), тесты.
- `plasma-android`: манифест плагина (парный change).
- Схема версии манифеста (`schemaVersion: 1`) не меняется: поле необязательное.
- Не входит: порядок групп из песочницы, группы для web-компонентов.
