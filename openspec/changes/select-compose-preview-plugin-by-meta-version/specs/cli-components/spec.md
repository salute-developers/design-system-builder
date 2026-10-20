## ADDED Requirements

### Requirement: API meta import passes the meta version and hash

Команда `dsbuilder components import-api` SHALL принимать взаимоисключающие опции `--uikit-compose-version <версия>` и `--plugin-manifest <путь к preview-plugin.json>`, вычислять sha256 байтов файла из `--from` до нормализации и передавать backend версию и sha256 в метаданных запроса. Для платформы `compose` при `--apply` одна из опций MUST быть задана. Для остальных платформ опции допустимы и необязательны.

#### Scenario: Версия из опции

- **WHEN** задан `--uikit-compose-version 0.55.0`
- **THEN** CLI MUST передать `meta.uikitComposeVersion = 0.55.0` и `meta.sha256` от байтов файла `--from`.

#### Scenario: Версия из manifest плагина

- **WHEN** задан `--plugin-manifest` и его `apiMetaSha256` совпадает с sha256 файла `--from`
- **THEN** CLI MUST передать `uikitComposeVersion` и sha256 из manifest.

#### Scenario: Мета не из этого билда

- **WHEN** `apiMetaSha256` manifest не совпадает с sha256 файла `--from`
- **THEN** CLI MUST завершиться ненулевым кодом, назвать оба значения и MUST NOT обращаться к backend.

#### Scenario: Compose без версии при записи

- **WHEN** платформа `compose`, задан `--apply`, а ни `--uikit-compose-version`, ни `--plugin-manifest` не указаны
- **THEN** CLI MUST завершиться ошибкой использования до обращения к backend.

#### Scenario: Compose без версии при пробном запуске

- **WHEN** платформа `compose`, `--apply` не задан и версия не указана
- **THEN** CLI MUST выполнить пробный запуск и MUST напечатать предупреждение, что версия меты не будет записана.

#### Scenario: Опции вместе

- **WHEN** заданы обе опции версии
- **THEN** CLI MUST завершиться ошибкой использования.

#### Scenario: Печать итога по версии

- **WHEN** backend вернул `metaVersion`
- **THEN** CLI MUST напечатать итог (`recorded`, `unchanged`, `replaced` с предыдущей версией или `not_provided`)
- **AND** при ответе `409` с кодом `meta_changed_without_version` CLI MUST завершиться ненулевым кодом и напечатать записанную версию.
