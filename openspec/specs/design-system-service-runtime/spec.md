# design-system-service-runtime Specification

## Purpose
Определяет runtime ds-service: модульную архитектуру, владение схемой через Flyway, контейнерный и локальный запуск, readiness и наблюдаемость.

## Requirements

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

### Requirement: Один UseCase на application-сценарий

Каждая операция route manifest SHALL вызывать отдельный класс `*UseCase` с единственным открытым методом `execute`; application-слой MUST NOT объединять несколько операций в интерфейсы или классы `*Queries`, `*Commands`, `*Operations`, общий `*Service` или универсальный CRUD use case.

#### Scenario: Route вызывает application-сценарий

- **WHEN** Ktor route завершил разбор и отображение request DTO
- **THEN** route MUST вызвать ровно один соответствующий `*UseCase.execute`
- **AND** use case MUST самостоятельно применить permission, транзакционную границу и нужный repository port

#### Scenario: CRUD одного ресурса

- **WHEN** ресурс поддерживает list, get, create, update и delete
- **THEN** каждая операция MUST иметь отдельный `List*UseCase`, `Get*UseCase`, `Create*UseCase`, `Update*UseCase` или `Delete*UseCase`
- **AND** реализации MUST NOT наследоваться от универсального `CrudUseCase`

#### Scenario: Специальная предметная операция

- **WHEN** маршрут выполняет lookup, resolve, import, export или агрегатное чтение
- **THEN** операция MUST иметь отдельный use case с предметным именем и типизированными входом и результатом

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

### Requirement: Раздельные проверки жизнеспособности и готовности

`ds-service` SHALL предоставлять liveness и readiness endpoints, причём readiness MUST быть закрыта при недоступной БД, невалидной policy, незавершённой Flyway-проверке или ошибке регистрации приложения.

#### Scenario: Процесс жив, но зависимость не готова

- **WHEN** процесс работает, но БД недоступна или Flyway validation завершилась ошибкой
- **THEN** liveness MUST сообщить, что процесс жив
- **AND** readiness MUST сообщить неготовность

#### Scenario: Сервис полностью готов

- **WHEN** БД доступна, миграции валидны, immutable policy загружена и маршруты зарегистрированы
- **THEN** readiness MUST сообщить готовность
- **AND** диагностика MUST включать безопасные `policyVersion`, hash policy и состояние Flyway без credentials

### Requirement: OpenAPI и наблюдаемость

`ds-service` SHALL публиковать OpenAPI только для разрешённого набора и SHALL записывать структурированные журналы и метрики, достаточные для проверки cutover без раскрытия предметных конфигураций и секретов.

#### Scenario: OpenAPI соответствует route manifest

- **WHEN** OpenAPI сервиса сравнивается с route manifest
- **THEN** все разрешённые операции MUST присутствовать
- **AND** исключённые операции MUST отсутствовать

#### Scenario: Диагностика запроса

- **WHEN** сервис завершает запрос
- **THEN** журнал MUST содержать correlation id, шаблон маршрута, actor type, project id, проверенный permission, результат и длительность
- **AND** журнал MUST NOT содержать access key, authorization header, пароль БД или полное тело `component-config`

#### Scenario: Метрики безопасности и БД

- **WHEN** происходят отказ RBAC, ownership miss, HTTP-ошибка или сбой транзакции
- **THEN** сервис MUST увеличить отдельный счётчик соответствующего класса
- **AND** MUST предоставлять метрики длительности запросов и состояния пула БД

### Requirement: Разделение платформ применяется миграцией поверх baseline

Контрактный отпечаток схемы (`contracts/schema-fingerprint.json`) и ожидаемый отпечаток локального контура SHALL описывать схему замороженного baseline Flyway (версия `1`), то есть состояние до разделения платформ компонентов.

#### Scenario: Миграция поверх замороженного исходного состояния

- **WHEN** Flyway применяет разделение платформ к исходной схеме
- **THEN** Разделение платформ и пометка устаревших алиасов (`component_platform`, `components.platform`, `deprecated`, `deprecated_message`) SHALL применяться Flyway-миграцией `V3__component_platform_split_and_axis_roles.sql` поверх baseline и не менять отпечаток baseline. Миграция MUST NOT опираться на временные таблицы, удаляемые при commit, и MUST останавливаться, если находит нативные данные, которые нельзя потерять.

#### Scenario: Пустая база

- **WHEN** Flyway поднимает пустую базу
- **THEN** MUST быть применены `V1`–`V3`, а схема MUST содержать `components.platform` и `property_platform_params.deprecated`

#### Scenario: Существующая база

- **WHEN** принимается база, приведённая Drizzle-миграциями до `0006` включительно
- **THEN** отпечаток MUST совпасть с контрактным, baseline MUST быть принят, а затем MUST быть применены `V2`–`V3`

#### Scenario: Дрейф схемы

- **WHEN** схема базы отличается от ожидаемой
- **THEN** принятие MUST быть отклонено
