## MODIFIED Requirements

### Requirement: Контейнерный и локальный запуск

`ds-service` SHALL иметь production `Dockerfile`, конфигурацию Docker Compose и общего локального контура, внутренний порт `8085` через `DS_SERVICE_PORT`, конфигурацию через окружение и автоматический healthcheck.

#### Scenario: Запуск контейнера

- **WHEN** образ `ds-service` запускается с JDBC URL, credentials БД, путём к policy, портом и параметрами пула
- **THEN** приложение MUST запуститься без встроенных секретов
- **AND** контейнер MUST объявлять тот же порт, который используют compose и Gateway

#### Scenario: Запуск общего локального контура

- **WHEN** разработчик запускает корневой `./setup-local.sh`
- **THEN** `ds-service` MUST запускаться вместе с необходимой БД и Gateway
- **AND** healthcheck MUST отражать состояние приложения без ручной настройки внутри контейнера

#### Scenario: Схему общей базы создаёт Flyway

- **WHEN** `./setup-local.sh` готовит общую базу `ds_registry`
- **THEN** Drizzle-миграции MUST NOT запускаться, а `ds-service` MUST создать схему Flyway-миграциями `V1`–`V4` в пустой базе без принятия существующей
- **AND** seed и привязка дизайн-системы `base` к проекту MUST выполняться после того, как `ds-service` создал схему

#### Scenario: Данные удаляются только явно

- **WHEN** разработчик запускает `./setup-local.sh` без опций
- **THEN** локальные данные обоих контуров MUST сохраняться
- **AND** удаление volumes MUST выполняться только опцией `--reset`

#### Scenario: База со схемой Drizzle

- **WHEN** в `ds_registry` есть таблицы, а истории Flyway нет
- **THEN** `./setup-local.sh` MUST остановиться до запуска `ds-service` с указанием выполнить `./setup-local.sh --reset`
