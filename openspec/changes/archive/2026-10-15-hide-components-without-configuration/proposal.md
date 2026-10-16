## Why

Часть Compose-компонентов есть в api-мете и привязана к дизайн-системе, но самой дизайн-системе стили для них не заданы:
у `DropdownLoadingState`, `Wheel`, `NavigationDrawer`, `NavigationDrawerItem`, `ModalBottomSheet`, `CollapsingNavigationBar` в базе
нет ни одной конфигурации. Редактор показывает их в меню, а превью рисует пустым стилем по умолчанию (тёмный текст, нет
индикатора), поэтому они выглядят сломанными.

## What Changes

- Compose-компонент без конфигурации оформления не загружается в редактор и не показывается в меню.
- Прямая ссылка на такой компонент перенаправляет на первый доступный компонент платформы.
- Web-компоненты не меняются.

## Capabilities

### New Capabilities

- `compose-component-visibility`: какие Compose-компоненты показывает редактор.

### Modified Capabilities

Нет.

## Impact

- `js/apps/client`: `composePreview/composeComponents.ts` (`hasConfiguration`), `api/themeEditorRepository.ts`, `pages/components/Components.tsx`, тесты.
- Данные, API и плагин не меняются. Компонент появится в меню сам, когда у него появится конфигурация.
