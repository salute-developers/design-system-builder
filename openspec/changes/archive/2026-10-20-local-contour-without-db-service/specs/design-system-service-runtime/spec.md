## MODIFIED Requirements

### Requirement: Контейнерный и локальный запуск

`ds-service` SHALL запускаться в контейнере и в общем локальном контуре `backend-kt` вместе со своей базой `ds_registry`, без JS-стека.

#### Scenario: Запуск контейнера

- **WHEN** образ `ds-service` запускается с переменными окружения БД и policy
- **THEN** сервис MUST стартовать, применить Flyway-миграции и открыть readiness только после успешной проверки зависимостей

#### Scenario: Запуск общего локального контура

- **WHEN** разработчик запускает корневой `./setup-local.sh`
- **THEN** `ds-service` MUST запускаться вместе с базой `ds-db` из `backend-kt/docker-compose.local.yml` и Gateway
- **AND** healthcheck MUST отражать состояние приложения без ручной настройки внутри контейнера
- **AND** JS-стек с db-service MUST NOT запускаться; из `js/docker-compose.dev.yml` поднимается только клиент

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
