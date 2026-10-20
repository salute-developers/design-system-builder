## MODIFIED Requirements

### Requirement: Flyway управляет схемой предметной БД

`ds-service` SHALL использовать Flyway как единственное средство применения миграций предметной схемы; baseline `V1` воспроизводит состояние схемы, унаследованной от прежнего db-service (ограничения, индексы, функции и триггеры).

#### Scenario: Инициализация пустой БД

- **WHEN** `ds-service` запускается с пустой поддерживаемой PostgreSQL-базой
- **THEN** Flyway MUST создать всю предметную схему
- **AND** итоговая схема и поведение триггеров MUST соответствовать контракту `contracts/schema-fingerprint.json` и интеграционным тестам ds-service

#### Scenario: Принятие существующей БД

- **WHEN** существующая БД соответствует проверенному текущему состоянию Drizzle-схемы и ещё не содержит `flyway_schema_history`
- **THEN** управляемая процедура MUST проверить fingerprint схемы до создания baseline
- **AND** MUST зарегистрировать согласованную baseline-версию без повторного выполнения DDL
- **AND** `flyway validate` MUST завершиться успешно до readiness

#### Scenario: Существующая схема отличается

- **WHEN** fingerprint существующей БД не соответствует ожидаемому состоянию
- **THEN** процедура MUST завершиться ошибкой до изменения migration history
- **AND** сервис MUST остаться неготовым до явного устранения расхождения

#### Scenario: Единственный владелец миграций

- **WHEN** Flyway принял предметную схему
- **THEN** Drizzle migration runner MUST быть отключён для этой БД
- **AND** никакой другой сервис MUST NOT применять миграции к этой БД

### Requirement: Контейнерный и локальный запуск

`ds-service` SHALL запускаться в контейнере и в общем локальном контуре `backend-kt` вместе со своей базой `ds_registry`, без JS-стека.

#### Scenario: Запуск контейнера

- **WHEN** образ `ds-service` запускается с переменными окружения БД и policy
- **THEN** сервис MUST стартовать, применить Flyway-миграции и открыть readiness только после успешной проверки зависимостей

#### Scenario: Запуск общего локального контура

- **WHEN** разработчик запускает корневой `./setup-local.sh`
- **THEN** `ds-service` MUST запускаться вместе с базой `ds-db` из `backend-kt/docker-compose.local.yml` и Gateway
- **AND** healthcheck MUST отражать состояние приложения без ручной настройки внутри контейнера
- **AND** из `js/docker-compose.dev.yml` поднимается клиент

#### Scenario: Схему общей базы создаёт Flyway

- **WHEN** `./setup-local.sh` готовит базу `ds_registry`
- **THEN** `ds-service` MUST создать схему Flyway-миграциями в пустой базе `ds-db` без принятия существующей
- **AND** наполнение дизайн-системой `base` MUST выполняться `backend-kt/bootstrap-base.sh` после того, как `ds-service` создал схему и Gateway готов

#### Scenario: Данные удаляются только явно

- **WHEN** разработчик запускает `./setup-local.sh` без опций
- **THEN** локальные данные обоих стеков MUST сохраняться
- **AND** удаление volumes MUST выполняться только опцией `--reset`

#### Scenario: База со схемой Drizzle

- **WHEN** в `ds_registry` есть таблицы, а истории Flyway нет
- **THEN** `ds-service` с `DS_FLYWAY_ADOPT_EXISTING=false` MUST остановиться на проверке Flyway, а разработчик пересоздаёт базу `./setup-local.sh --reset`

## REMOVED Requirements

### Requirement: Совместное существование и атомарное переключение

**Reason**: db-service удалён, сосуществование и откат на него невозможны.

**Migration**: ds-service — единственный upstream предметного API; откат выполняется версией образа ds-service.
