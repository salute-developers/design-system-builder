# web-preview-plugin-selection Specification

## Purpose
TBD - created by archiving change publish-web-preview-plugin. Update Purpose after archive.
## Requirements
### Requirement: Клиент получает адрес web-плагина от бэкенда

Без прямого адреса в `VITE_WEB_PREVIEW_PLUGIN_URL` клиент SHALL запрашивать `GET /api/projects/{projectId}/ds/web-preview/plugin` и загружать web-плагин из `pluginUrl` ответа. Адрес SHALL запрашиваться не чаще одного раза на страницу и проект; неудачный запрос MUST NOT кешироваться. Адрес MUST NOT зависеть от выбранной версии дизайн-системы. Запрос MUST выполняться только когда в разделе есть web-компоненты.

#### Scenario: Опубликованный билд

- **WHEN** переменная не задана, а бэкенд отдаёт `pluginUrl` активного web-билда
- **THEN** превью web-компонента MUST загружаться из этого адреса

#### Scenario: Смена компонента

- **WHEN** пользователь переключается между web-компонентами на одной странице
- **THEN** клиент MUST NOT запрашивать адрес повторно

### Requirement: Прямой адрес web-плагина обходит бэкенд

Если `VITE_WEB_PREVIEW_PLUGIN_URL` задана непустым значением, клиент SHALL загружать web-плагин по ней и MUST NOT запрашивать адрес у бэкенда. Это режим разработки самого плагина.

#### Scenario: Разработка плагина

- **WHEN** клиент собран с `VITE_WEB_PREVIEW_PLUGIN_URL=http://localhost:3011/`
- **THEN** web-плагин MUST загружаться с `http://localhost:3011/` без запроса `web-preview/plugin`

### Requirement: Отсутствие web-билда отключает только web-превью

Если бэкенд отвечает `404` или запрос адреса завершился ошибкой, область превью web-компонента SHALL показывать «Превью недоступно» с причиной, а панель настройки SHALL работать. Compose-превью и остальные разделы MUST NOT зависеть от адреса web-плагина. Клиент MUST NOT подставлять адрес по умолчанию.

#### Scenario: Web-плагин не опубликован

- **WHEN** бэкенд отвечает `404` на запрос адреса web-плагина
- **THEN** превью web-компонента MUST показать «Превью недоступно» с причиной, что web-плагин не опубликован
- **THEN** Compose-превью MUST работать

