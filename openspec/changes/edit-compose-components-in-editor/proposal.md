## Why

Compose-preview в редакторе сейчас работает только как «переключатель Renderer» у web-компонента
`Button`: клиент жёстко привязывает его к `BasicButton` (`LEGACY_COMPOSE_PREVIEW_BINDINGS`). Это
не даёт ни одной настройки: у web-компонентов нет Compose-параметров свойств
(`property_platform_params` содержит только `web`), поэтому `size`, `shape` и отступы не попадают
в payload, а `BasicButton` рисуется своим дефолтным стилем.

После разделения платформ (`components.platform`) Compose-компоненты — самостоятельные
компоненты со своими свойствами и Compose-параметрами, которые заводит импорт API-меты. Их не
нужно сопоставлять с web: их нужно показать в редакторе и отрисовать плагином. Сейчас это
невозможно по трём причинам:

- в БД нет Compose-компонентов и нет их привязки к дизайн-системе;
- `legacy/.../component-configs` жёстко фильтрует `platform = 'web'`;
- меню компонентов клиента — фиксированный список web-имён, а имена Compose и web частично
  совпадают (34 из 79), так что платформа обязана быть частью идентичности компонента.

## What Changes

- `GET /legacy/design-systems/{name}/component-configs` получает необязательный параметр
  `platform` (`web` | `compose`). Без параметра поведение прежнее (`web`): генератор и текущий
  клиент не меняются. С `platform=compose` отдаются Compose-компоненты дизайн-системы с
  `platformMappings.compose`.
- Клиент при заданном `VITE_COMPOSE_PREVIEW_PLUGIN_URL` дополнительно загружает Compose-конфиги и
  показывает их через переключатель платформ над списком компонентов (Web / Compose; показываются только платформы,
  у которых есть компоненты). Compose-компоненты раскладываются по тем же группам, что и web, а не
  входящие в каталог попадают в группу «Other». Идентичность компонента в клиенте включает
  платформу, коллизии имён с web невозможны.
- Привязка к плагину выводится из компонента: Compose-конфиг получает
  `preview.compose = {componentId: <имя>, storyId: <имя>}` и показывается, только если имя есть в
  `manifest.components`. `LEGACY_COMPOSE_PREVIEW_BINDINGS` и переключатель Renderer у web-компонентов
  удаляются.
- Редактор Compose-компонента использует только Compose-renderer (React-preview для него не
  существует), платформа значений темы — `android`.
- Локальный контур получает воспроизводимый шаг «импорт Compose API-меты и привязка Compose-компонентов
  к дизайн-системе» (опция `setup-local.sh`), чтобы проверка не требовала ручных правок БД.
- **BREAKING (локально)**: web `Button` больше не показывает Compose-переключатель; поведение
  исчезает вместе с жёсткой привязкой, она ничего не настраивала.

## Capabilities

### New Capabilities

- `compose-component-editor`: загрузка, выбор и редактирование Compose-компонентов дизайн-системы
  в редакторе с preview через Compose-плагин.

### Modified Capabilities

- `compose-preview-rollout`: условие включения Compose-preview определяется платформой компонента
  и составом манифеста, а не жёсткой привязкой имени.

## Impact

- `js/services/db-service` (`routes/api/legacy.ts`, OpenAPI), `js/apps/client` (api, controllers,
  меню, `ComponentEditorPreview`), `setup-local.sh` и вспомогательный скрипт импорта.
- Preview Protocol, плагин и plasma-android не меняются.
- Зависит от `compose-preview-core-components` (79 компонентов в плагине).
