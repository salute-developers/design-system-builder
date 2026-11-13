# Повторно используемая сборка ds-service

## MODIFIED Requirements

### Requirement: Модульная архитектура ds-service

`ds-service` SHALL быть отдельной Kotlin Gradle-сборкой с модулями `app`, `runtime`, `core`, `feature-design-systems`, `feature-themes`, `feature-tokens` и `feature-components` и SHALL соблюдать направление зависимостей `presentation -> application -> domain`.

#### Scenario: Проверка модульного графа

- **WHEN** выполняются архитектурные тесты `backend-kt`
- **THEN** feature-модули MUST зависеть от `core`, но MUST NOT зависеть друг от друга
- **AND** `runtime` MUST собирать feature-модули без собственной точки запуска
- **AND** отдельный `app` сервиса и монолитный `backend-kt/app` MUST подключать один и тот же `runtime` без зависимости от другого исполняемого приложения

#### Scenario: Проверка слоёв feature-модуля

- **WHEN** статический архитектурный тест анализирует production-код feature-модуля
- **THEN** `domain` MUST NOT зависеть от Ktor, Exposed, Koin, Docker или внешних DTO
- **AND** `application` MUST зависеть от `domain` и собственных портов, но MUST NOT зависеть от `presentation` или конкретной реализации `data`
- **AND** инфраструктурные реализации MUST находиться в `data`, а связывание зависимостей — в `di`

#### Scenario: Читаемое размещение типов

- **WHEN** в сервис добавляется публичный DTO, use case, repository contract или предметный тип
- **THEN** он MUST размещаться в отдельном согласованно названном файле, кроме малых тесно связанных value objects
- **AND** один файл MUST NOT использоваться как несвязанный контейнер классов нескольких ресурсов

### Requirement: Контейнерный и локальный запуск

Функции `ds-service` SHALL запускаться внутри единого backend-монолита вместе с отдельной базой `ds_registry`. Создание схемы и работа предметного API SHALL NOT требовать JS-стека. Самостоятельный контейнер ds-service и nginx SHALL NOT требоваться.

#### Scenario: Запуск контейнера

- **WHEN** образ монолита запускается с переменными окружения БД и политики доступа
- **THEN** runtime ds MUST инициализироваться, применить Flyway-миграции и открыть общую готовность только после успешной проверки обязательных зависимостей

#### Scenario: Запуск общего локального контура

- **WHEN** разработчик запускает корневой `./setup-local.sh`
- **THEN** функции ds MUST обслуживаться монолитом вместе с отдельной базой `ds-db` из `backend-kt/docker-compose.local.yml`, без nginx и отдельного контейнера ds-service
- **AND** healthcheck MUST отражать состояние приложения без ручной настройки внутри контейнера
- **AND** из `js/docker-compose.dev.yml` поднимается клиент

#### Scenario: Схему общей базы создаёт Flyway

- **WHEN** `./setup-local.sh` готовит пустую базу `ds_registry`
- **THEN** runtime ds MUST создать схему Flyway-миграциями в базе `ds-db` без принятия существующей
- **AND** наполнение дизайн-системой `base` MUST выполняться `backend-kt/bootstrap-base.sh` после создания схемы и готовности публичного API монолита

#### Scenario: Данные удаляются только явно

- **WHEN** разработчик запускает `./setup-local.sh` без опций
- **THEN** существующие данные backend и клиента MUST сохраняться
- **AND** удаление томов MUST выполняться только явно указанной опцией `--reset`, которая не применяется при однократном переходе к монолиту

#### Scenario: База со схемой Drizzle

- **WHEN** в `ds_registry` есть таблицы, а истории Flyway нет
- **THEN** runtime ds с `DS_FLYWAY_ADOPT_EXISTING=false` MUST остановиться на проверке Flyway
- **AND** принятие поддерживаемой схемы выполняется отдельной управляемой процедурой; пересоздание локальной базы через `./setup-local.sh --reset` допускается только по явному решению разработчика
