## ADDED Requirements

### Requirement: Единый Kotlin runtime
Backend monolith MUST запускать Identity, Projects и Documentation capabilities в одном Ktor `Application` и одном Ktor engine с единым lifecycle.

#### Scenario: Успешный запуск monolith
- **WHEN** обязательная конфигурация, databases и внешние integrations доступны
- **THEN** один Kotlin JVM process MUST зарегистрировать Identity, Projects и Documentation routes на одном внутреннем port
- **AND** система MUST NOT запускать отдельные Auth Helper, Projects Service или Documentation Service JVM processes

#### Scenario: Ошибка обязательного Kotlin bootstrap
- **WHEN** инициализация обязательной capability завершается ошибкой до готовности приложения
- **THEN** Ktor application MUST завершить startup с ненулевым exit
- **AND** monolith MUST NOT сообщать readiness

### Requirement: Feature-модули не владеют общим runtime
Identity, Projects и Documentation feature-модули MUST предоставлять переиспользуемые route, DI, application и runtime contracts, а `monolith:app` MUST владеть engine, общими Ktor plugins, общей конфигурацией, health routes и graceful shutdown.

#### Scenario: Композиция routes
- **WHEN** `monolith:app` собирает Ktor routing
- **THEN** feature-модули MUST зарегистрировать свои routes без создания дополнительных engines
- **AND** только monolith MUST зарегистрировать общие liveness/readiness routes

#### Scenario: Standalone apps сохранены
- **WHEN** разработчик собирает существующий Identity, Projects или Documentation app
- **THEN** app MUST использовать те же переиспользуемые feature/runtime contracts
- **AND** существующая standalone build entrypoint MUST оставаться доступной на период миграции

### Requirement: In-process взаимодействие Kotlin capabilities
Kotlin capabilities внутри monolith MUST взаимодействовать через типизированные application contracts и MUST NOT направлять internal calls через nginx или loopback HTTP в целевом состоянии.

#### Scenario: Identity проверяет доступ пользователя к project
- **WHEN** Identity авторизует authenticated user для project-scoped запроса
- **THEN** Identity MUST вызвать Projects application contract в том же JVM process
- **AND** система MUST NOT выполнять HTTP-запрос к `/internal/projects/**`

#### Scenario: Identity проверяет project access key
- **WHEN** Identity получает credential типа ProjectKey
- **THEN** Identity MUST вызвать Projects access-key verification contract в том же JVM process
- **AND** результат MUST сохранять существующие `projectId`, `keyId` и scopes semantics

#### Scenario: Business authorization после authentication
- **WHEN** trusted actor context передаётся из Identity в другую Kotlin capability
- **THEN** исходный JWT MUST NOT проверяться повторно
- **AND** целевой use case MUST продолжить применять project role, ownership и scope rules

### Requirement: Прямое взаимодействие Kotlin с db-service
Kotlin monolith MUST обращаться к Node.js `db-service` напрямую по loopback HTTP и MUST NOT направлять internal traffic через nginx.

#### Scenario: Documentation проверяет ownership design system
- **WHEN** Documentation проверяет доступность design system в trusted project context
- **THEN** adapter MUST вызвать `db-service` на loopback address
- **AND** adapter MUST передать нормализованные trusted actor/project headers без исходного `Authorization`

#### Scenario: db-service недоступен
- **WHEN** direct loopback request завершается timeout, connection failure или ответом `5xx`
- **THEN** вызывающая capability MUST вернуть существующий unavailable result
- **AND** запрос MUST NOT повторно направляться через nginx

### Requirement: Изоляция internal ports и trusted headers
Monolith container MUST публиковать только nginx port `8080`; Kotlin port `8081` и Node port `3008` MUST быть доступны только через loopback внутри container.

#### Scenario: Внешний клиент подделывает trusted headers
- **WHEN** внешний клиент отправляет `X-Actor-*`, `X-Project-*` или `X-System-Admin`
- **THEN** nginx MUST удалить client-provided values
- **AND** downstream MUST получить только context, сформированный успешным auth flow

#### Scenario: Другой container обращается к db-service напрямую
- **WHEN** процесс вне monolith container пытается подключиться к port `3008`
- **THEN** соединение MUST быть недоступно

#### Scenario: Внешний клиент обращается к internal route
- **WHEN** внешний клиент обращается к `/internal/**` через port `8080`
- **THEN** nginx MUST отклонить запрос без передачи в Kotlin или Node runtime

### Requirement: nginx остаётся внешней trust boundary
nginx MUST сохранять существующие public paths, `auth_request`, path rewrites, trusted-header normalization, CORS, rate limits, body limits и timeout semantics, направляя все Kotlin upstreams в единый monolith, кроме явно исключённых administrative routes.

#### Scenario: Keycloak public auth mappings сохранены
- **WHEN** клиент обращается к `/auth/token`, `/auth/logout` или `/auth/account`
- **THEN** nginx MUST сохранить legacy realm endpoint или redirect mapping
- **AND** proxied Keycloak routes MUST сохранить rate limit, forwarded headers, trusted-header clearing и production TLS SNI semantics

#### Scenario: Administrative routes исключены
- **WHEN** внешний клиент обращается к `/admin`, `/admin/**`, `/api/admin` или `/api/admin/**`
- **THEN** nginx MUST вернуть `404`
- **AND** запрос MUST NOT быть передан в Keycloak, Kotlin monolith или `db-service`

#### Scenario: Trailing slash Projects redirect сохранён
- **WHEN** клиент обращается к `/api/projects/`
- **THEN** nginx MUST вернуть redirect `308` на `/api/projects`

#### Scenario: Documentation proxy contract сохранён
- **WHEN** разрешённый запрос проходит через project-scoped Documentation route
- **THEN** nginx MUST отключить request и response buffering
- **AND** MUST передать request id, host и forwarded headers
- **AND** MUST сохранить configured body-size и timeout limits

#### Scenario: Project-scoped Kotlin route
- **WHEN** авторизованный клиент обращается к существующему project-scoped Identity, Projects или Documentation API
- **THEN** nginx MUST выполнить существующий auth flow
- **AND** nginx MUST направить разрешённый запрос на Kotlin monolith port `8081`

#### Scenario: Project-scoped db-service route
- **WHEN** авторизованный клиент обращается к существующему project-scoped design-system API
- **THEN** nginx MUST выполнить существующий auth flow
- **AND** nginx MUST направить разрешённый запрос на Node port `3008`

#### Scenario: Rendered gateway configuration проверяется
- **WHEN** выполняется nginx contract test monolith
- **THEN** test MUST подставить environment configuration в template
- **AND** MUST проверить route-scoped semantics в полностью отрендеренном конфиге

### Requirement: Атомарный lifecycle container
Monolith image MUST запускать nginx, Kotlin monolith и `db-service` под fail-fast supervisor, который завершает весь container при завершении любого обязательного процесса.

#### Scenario: Kotlin process аварийно завершается
- **WHEN** Kotlin process завершается
- **THEN** supervisor MUST послать termination signal nginx и Node process
- **AND** container MUST завершиться с ненулевым exit

#### Scenario: Node process штатно завершается сам
- **WHEN** `db-service` process завершается с code `0` без команды остановки container
- **THEN** supervisor MUST считать это потерей обязательного component
- **AND** container MUST завершиться с ненулевым exit после остановки остальных процессов

#### Scenario: Container получает SIGTERM
- **WHEN** runtime посылает SIGTERM container
- **THEN** supervisor MUST передать termination signal всем обязательным процессам
- **AND** MUST ожидать их graceful shutdown только в пределах configured timeout

### Requirement: Агрегированные liveness и readiness
Monolith deployment MUST предоставлять проверки состояния nginx, Kotlin application, Documentation worker, обязательных persistence/storage integrations и `db-service`.

#### Scenario: Все обязательные компоненты готовы
- **WHEN** nginx, Kotlin runtime, Documentation worker, databases, storage и `db-service` готовы
- **THEN** container healthcheck MUST завершиться успешно

#### Scenario: Обязательный компонент не готов
- **WHEN** любой обязательный компонент возвращает отрицательный readiness
- **THEN** container healthcheck MUST завершиться неуспешно
- **AND** liveness MUST оставаться отдельной проверкой от временной недоступности внешней integration

### Requirement: Отдельный monolith compose contour
Репозиторий MUST предоставлять новый docker-compose contour, который запускает monolith backend и локальные Keycloak, PostgreSQL и S3-compatible integrations без изменения legacy compose-файлов.

#### Scenario: Локальный запуск monolith
- **WHEN** разработчик запускает новый monolith start script с валидной локальной конфигурацией
- **THEN** Compose MUST собрать или загрузить monolith image
- **AND** MUST запустить обязательные integration services и дождаться их startup dependencies

#### Scenario: Остановка monolith contour
- **WHEN** разработчик запускает monolith start script с `--down`
- **THEN** script MUST остановить только ресурсы нового monolith contour
- **AND** MUST NOT изменять volumes или containers legacy contours

### Requirement: Deprecated runtime исключён
Новый monolith Docker image и compose MUST исключать `project-publisher`, `generator`, `publisher` и `documentation-generator`.

#### Scenario: Инспекция нового compose
- **WHEN** оператор разбирает effective monolith compose configuration
- **THEN** она MUST содержать Kotlin monolith и `db-service`
- **AND** MUST NOT содержать deprecated runtime services

### Requirement: Обратимый параллельный переход
Новый monolith deployment MUST сосуществовать с legacy build и deployment paths до отдельного change на их удаление.

#### Scenario: Сборка legacy service
- **WHEN** разработчик запускает существующую build-команду Identity, Projects или Documentation service
- **THEN** сборка MUST оставаться доступной

#### Scenario: Rollback с monolith
- **WHEN** оператор возвращает traffic на legacy deployment
- **THEN** rollback MUST NOT требовать обратной миграции публичных API или persistence schemas, введённой только monolith runtime
