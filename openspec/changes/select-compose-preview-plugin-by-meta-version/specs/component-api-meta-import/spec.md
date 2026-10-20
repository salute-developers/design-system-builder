## ADDED Requirements

### Requirement: API meta import carries the meta version

Метаданные `meta` тела запроса импорта SHALL допускать необязательные `uikitComposeVersion` (непустая строка семантической версии) и `sha256` (шестнадцатеричная строка из 64 символов). Ответ импорта SHALL содержать объект `metaVersion` с полем `status` (`recorded`, `unchanged`, `replaced` или `not_provided`) и, для `replaced`, предыдущие `uikitComposeVersion` и `sha256`. Правила записи, идемпотентности и отказа описывает capability `component-meta-version`. Прежние поля запроса и ответа MUST остаться без изменений, поэтому уже выпущенные версии CLI MUST продолжать работать.

#### Scenario: Версия и sha256 принимаются

- **WHEN** запрос содержит `meta.uikitComposeVersion` и `meta.sha256` корректного формата
- **THEN** backend MUST принять запрос и вернуть `metaVersion.status`.

#### Scenario: Некорректный формат

- **WHEN** `uikitComposeVersion` пуста или не является семантической версией, либо `sha256` не состоит из 64 шестнадцатеричных символов
- **THEN** backend MUST ответить ошибкой валидации и MUST NOT изменить данные.

#### Scenario: Старый CLI

- **WHEN** запрос не содержит новых полей
- **THEN** ответ MUST содержать все прежние поля отчёта и `metaVersion.status = not_provided`.

### Requirement: API meta import records the meta version in the changes journal

Запись журнала изменений импорта SHALL содержать переданные `uikitComposeVersion` и `sha256` и итог `metaVersion.status`, если версия передана.

#### Scenario: Версия в журнале

- **WHEN** импорт с версией завершён
- **THEN** запись журнала `components:import-api-meta` MUST содержать версию, sha256 и итог по версии.
