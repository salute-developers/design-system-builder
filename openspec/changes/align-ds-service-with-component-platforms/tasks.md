## 1. Схема и Flyway

- [x] 1.1 Таблицы Exposed: `components.platform`, без `platform` у `properties` и `appearances` (в том числе в `AggregateAppearancesTable`), `property_platform_params` на `component_platform` с `deprecated` и `deprecated_message`, `design_system_changes.design_system_id` nullable; удалить `PropertyPlatformDb`, добавить `xml` в `ComponentPlatformDb`
- [x] 1.2 Пересчитать отпечаток схемы: `contracts/schema-fingerprint.json`, `DS_EXPECTED_SCHEMA_SHA256` в `docker-compose.local.yml`, константа в `FlywayPostgresIntegrationTest`
- [x] 1.3 Миграция `0007` не использует `ON COMMIT DROP` (baseline Flyway выполняется вне транзакции)

## 2. Маршруты и DTO

- [x] 2.1 Компоненты: `platform` в создании и ответах, валидация словаря; убрать платформу из ответов свойств, appearances и сводки appearances; в запросах принимать и игнорировать
- [x] 2.2 `property-platform-params`: `deprecated` и `deprecatedMessage` в создании, изменении (явный `null`) и ответе
- [x] 2.3 `component-config`: `platform` в `GET`, `import`, `export`; импортёр и экспорт работают в пределах платформы; платформа в причине отказа и в журнале

## 3. Тесты и контракт

- [x] 3.1 Обновить существующие тесты (`DsServiceHttpPostgresIntegrationTest`, `OpenApiDocumentFactoryTest`, `ComponentUseCaseTest`, `ComponentConfigContractTest`)
- [x] 3.2 Новый интеграционный тест `ComponentPlatformHttpPostgresIntegrationTest`: платформа компонента, дубликат, алиасы и `deprecated`, `component-config` по платформам, журнал без дизайн-системы; мутации импортёра и экспорта ловятся
- [x] 3.3 Фикстуры дифференциального runner `db-service` под новую схему; прогнать runner на базовой ветке и на этой и сравнить наборы расхождений: новых нет
- [x] 3.4 Убрать из spec-артефактов change `migrate-db-service-to-kotlin-ds-service` ссылки на удалённый `import-uikit-api-meta.sh` и удалить его тестовый скрипт
