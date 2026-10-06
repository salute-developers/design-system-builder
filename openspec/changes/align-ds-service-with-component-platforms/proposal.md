## Why

В `db-service` компонент теперь идентифицируется парой `(name, platform)`, а у алиаса платформенного имени появились признак устаревания и сообщение (change `split-component-platforms-and-api-deprecated`). После переключения gateway на Kotlin `ds-service` его предметные маршруты (`components`, `properties`, `appearances`, `property-platform-params`, `component-config`) обслуживают именно эту схему, но `ds-service` её не знает: создаёт компоненты без платформы (колонка `NOT NULL`), ищет компонент по одному имени, описывает таблицу `appearances` со старой колонкой `platform` (что даёт `500` на `GET /design-systems/{id}/appearances`), а Flyway-baseline и отпечаток схемы не соответствуют новой схеме. Команды CLI `components push` и `components fetch` передают платформу, и без поддержки в `ds-service` их запросы перестанут работать после переключения.

## What Changes

- **Схема.** Таблицы Exposed повторяют новую схему: `components.platform` (`component_platform`: `web`, `compose`, `xml`, `ios`), без `properties.platform` и `appearances.platform`, `property_platform_params` с `platform` того же перечисления и колонками `deprecated`, `deprecated_message`, `design_system_changes.design_system_id` необязательный. Baseline Flyway `V1` по-прежнему собирается из Drizzle-миграций (в него входит `0007`), отпечаток схемы `schema-fingerprint.json` и `DS_EXPECTED_SCHEMA_SHA256` в `docker-compose.local.yml` обновлены.
- **Компоненты.** `POST /components` требует `platform` и отвечает `400` без него или со значением вне словаря; ответы компонентов содержат `platform`; поля `platform` убраны из ответов свойств, appearances и сводки appearances дизайн-системы (в запросах остаётся принимаемое и игнорируемое поле для совместимости).
- **Алиасы.** `property-platform-params` принимают и возвращают `deprecated` и `deprecatedMessage`; PATCH отличает отсутствие `deprecatedMessage` от явного `null`.
- **`component-config`.** `GET /component-config` требует `platform` в запросе, `POST /component-config/import` и `/export` — в теле (иначе `400`). Компонент ищется среди компонентов этой платформы, экспорт отдаёт конфигурации только их, отказ импорта называет платформу, журнал `components:import` хранит `platform`.
- **Контракт.** Дифференциальный runner `db-service` и ds-service сравнивает обе реализации на фикстурах новой схемы; из spec-артефактов change `migrate-db-service-to-kotlin-ds-service` убраны ссылки на удалённый `import-uikit-api-meta.sh` (глобальный слой наполняет CLI через административную ручку `db-service`).

Не входит: перенос административной ручки `import-api-meta` в `ds-service` (маршруты `admin` остаются на `db-service`), изменение уже расходящихся маршрутов, которые различает дифференциальный набор на базовой ветке (16 известных расхождений темы и проектной видимости).

## Capabilities

### New Capabilities
Нет.

### Modified Capabilities
- `design-system-model-api`: платформа компонента, признак устаревания алиаса и платформа в `component-config` в контракте `ds-service`.
- `design-system-service-runtime`: схема, Flyway baseline и отпечаток схемы соответствуют модели с платформами.

## Impact

- **backend-kt/ds-service**: `feature-components` (таблицы, репозитории, импортёр, маршруты и DTO), `feature-design-systems` (сводка appearances, журнал), `app` (маршруты, тесты), `contracts/schema-fingerprint.json`, `docker-compose.local.yml`.
- **js/services/db-service**: фикстуры дифференциального runner; миграция `0007` не использует `ON COMMIT DROP`, так как Flyway выполняет baseline вне транзакции.
- **Совместимость**: **BREAKING** для клиентов `component-config` и создания компонентов без платформы (и в `db-service`, и в `ds-service`); backend и CLI выкатываются вместе.
