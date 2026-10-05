## 1. Эталон контракта и каркас сервиса

- [x] 1.1 Сформировать из маршрутов `db-service` машиночитаемый route manifest с методом, путём, DTO, статусами, permission, правилом ownership и признаком включения или исключения; проверить его против OpenAPI и фактической регистрации Express routes.
- [x] 1.2 Зафиксировать эталонные HTTP-фикстуры и дифференциальный набор для чтений и мутаций всех включённых групп, включая ошибки, `null`, отсутствующие поля, порядок массивов и текущее поведение `component-config`.
- [x] 1.3 Создать `backend-kt/ds-service` как Gradle-сборку с модулями `app`, `core`, `feature-design-systems`, `feature-themes`, `feature-tokens`, `feature-components` и подключить её в `backend-kt/settings.gradle.kts`.
- [x] 1.4 Настроить convention plugins, version catalog, KDoc и архитектурные тесты, запрещающие недопустимые зависимости слоёв и feature-модулей, агрегирующие application-классы `*Queries`/`*Commands`/`*Operations`, универсальные CRUD use case и несвязанное размещение публичных типов в одном файле.

## 2. Общая инфраструктура и Flyway

- [x] 2.1 Реализовать в `core` загрузку конфигурации, пул PostgreSQL, `TransactionRunner`, общие идентификаторы, время, модель ошибок и безопасное отображение технических сбоев без предметных сущностей.
- [x] 2.2 Подключить существующий Gradle-проект `backend-kt/authorization-core`; переиспользовать `AuthorizationPolicyLoader`, `PolicyEvaluator`, `TrustedProjectPrincipalFactory`, `ProjectPrincipal` и `PolicyDiagnostics`, добавив только тонкий `DsAccessPolicy` для отображения результата в `DsFailure`; запретить архитектурным тестом локальные копии policy/principal/evaluator и отдельно покрыть Gateway-тестом совпадение публичного path `projectId` с `X-Project-Id` до переписывания пути.
- [x] 2.3 Перенести текущую схему `schema.ts` и применённые Drizzle DDL в проверенный Flyway baseline, включая таблицы, типы, defaults, ключи, индексы, функции и триггеры `0004_component_import.sql`.
- [x] 2.4 Реализовать отдельную процедуру принятия существующей БД с schema fingerprint, явным baseline и `flyway validate`, которая завершается ошибкой до изменения history при несовпадении схемы.
- [x] 2.5 Добавить обязательные интеграционные тесты Flyway на реальном PostgreSQL/Testcontainers для пустой БД, копии текущей схемы, повторного запуска и отказа при drift; отсутствие Docker или БД MUST завершать этот gate ошибкой, а не пропуском.
- [x] 2.6 Настроить режим, в котором после принятия схемы только Flyway применяет миграции, а `db-service` при совместном запуске и откате не запускает Drizzle migration runner.

## 3. Runtime и эксплуатационный контур

- [x] 3.1 Реализовать Ktor `app`, Koin composition root, JSON/error middleware, ограничение тела не меньше `16 MiB` для импорта, correlation id и регистрацию feature routes.
- [x] 3.2 Добавить раздельные liveness/readiness endpoints с проверками БД, Flyway, immutable policy и регистрации приложения, а также безопасной диагностикой `policyVersion` и hash.
- [x] 3.3 Добавить OpenAPI из явных DTO и route manifest, исключив `legacy`, `admin`, `documentation-pages`, `saved-queries` и генерацию.
- [x] 3.4 Добавить структурированные журналы и метрики HTTP, RBAC, ownership, транзакций и пула БД без credentials и тел конфигураций.
- [x] 3.5 Добавить production `Dockerfile`, `.dockerignore`, `application.yaml`, документированные переменные окружения, `DS_SERVICE_PORT=8085` и container healthcheck.
- [x] 3.6 Подключить `ds-service` к `backend-kt/docker-compose.yml`, `backend-kt/start-local.sh` и корневому локальному контуру с согласованными портом, зависимостями, сетью и secrets-from-environment.

## 4. Дизайн-системы, версии, изменения и темы

- [x] 4.1 Реализовать domain-модели, application ports, отдельный `*UseCase` для каждой операции и project-scoped Exposed repositories дизайн-систем, версий и журнала изменений с поддержкой разрешённого глобального чтения.
- [x] 4.2 Реализовать явные DTO и Ktor routes полного набора `design-systems`, `design-system-versions` и `design-system-changes`, включая агрегаты компонентов, токенов, тем, внешних видов и изменений.
- [x] 4.3 Реализовать domain-модели, application ports, отдельные `List/Get/Create/Update/DeleteTenantUseCase` и `GetTenantTokenValuesUseCase`, repositories, DTO и routes `tenants` без переименования внешнего контракта.
- [x] 4.4 Добавить модульные тесты use case и mapper, repository-тесты на ownership/global access и Ktor route-тесты успешных, невалидных, `403` и нераскрывающих `404` сценариев этой группы.

## 5. Токены, значения и палитра

- [x] 5.1 Реализовать domain-модели, application ports, отдельный `*UseCase` для каждой CRUD/lookup операции и project-scoped repositories токенов, значений токенов и палитры с сохранением ссылочных и разрешённых значений.
- [x] 5.2 Реализовать явные DTO и все routes `tokens`, `token-values`, `palette`, включая `tokens/{id}/values`, `tenants/{id}/token-values` и `palette/by-type/{type}`.
- [x] 5.3 Добавить модульные тесты use case/mapper, repository-тесты связей и фильтров и Ktor route-тесты совместимости, RBAC и ownership этой группы.

## 6. Компонентная модель и component-config

- [x] 6.1 Реализовать domain/application/data/di и отдельный `*UseCase` для каждой операции компонентов, связей дизайн-системы, зависимостей и reuse-конфигураций с ownership через доступную дизайн-систему.
- [x] 6.2 Реализовать domain/application/data/di и отдельный `*UseCase` для каждой операции вариаций, свойств, property-platform params, property-variations и variation/invariant platform adjustments.
- [x] 6.3 Реализовать domain/application/data/di и отдельный `*UseCase` для каждой операции appearances, appearance variations/values, styles, variation/invariant property values, states/state-sets и style combinations/members.
- [x] 6.4 Реализовать явные DTO и все CRUD, вложенные и lookup routes компонентной модели из route manifest; каждый route MUST вызывать ровно один соответствующий `*UseCase`, исключённые маршруты не публикуются.
- [x] 6.5 Реализовать `GetComponentConfigUseCase`, `ImportComponentConfigUseCase` и `ExportComponentConfigUseCase` для `GET /component-config`, `POST /component-config/import` и `POST /component-config/export` с текущими DTO, одной транзакцией импорта, фильтрами экспорта, RBAC и сохранением существующей семантики `version`.
- [x] 6.6 Добавить модульные тесты каждого use case и mapper и Ktor route-тесты каждой группы компонентной модели, включая невалидные ссылки, каскады, sentinel guards, state-set resolution, `16 MiB`, `403` и ownership `404`.
- [x] 6.7 Добавить PostgreSQL repository/transaction-тесты, доказывающие эквивалентность функций, триггеров, ограничений и итогового состояния импорта текущему `db-service`; обязательная БД MUST быть явным gate.

## 7. Интеграции, маршрутизация и совместимость

- [x] 7.1 Обновить Gateway upstream и правила переписывания для атомарного переключения разрешённого `/api/projects/{projectId}/ds/**`, полного набора trusted headers, сетевой изоляции внутреннего порта и проверенной конфигурации отката.
- [x] 7.2 Зафиксировать более специфичные Gateway rules для реально используемых исключённых маршрутов, которые временно остаются в `db-service`, не добавляя их в OpenAPI `ds-service`.
- [x] 7.3 Перевести ownership client `documentation-service` на `ds-service`, сохранив документированные timeout/error semantics и добавив focused client tests.
- [x] 7.4 Перевести `backend-kt/scripts/import-uikit-api-meta.sh` на защищённый импорт `ds-service` с trusted `system_admin` контекстом и добавить проверяемый dry-run/изоляционный тест глобального слоя.
- [x] 7.5 Провести репозиторный аудит `frontend-kt` и `js/apps/client` по включённым и исключённым маршрутам; обновить потребителя только при доказанной несовместимости и добавить его штатные тесты/сборку.
- [x] 7.6 Запустить дифференциальные контрактные тесты всех включённых чтений на общей фикстуре и всех мутаций на изолированных БД; устранить все необъявленные различия статусов, DTO и состояния.

## 8. Локальная проверка и независимое ревью

- [x] 8.1 Выполнить `cd backend-kt/ds-service && ./gradlew test detekt spotlessCheck build` со всеми обязательными PostgreSQL/Flyway-тестами.
- [x] 8.2 Выполнить сборки и тесты затронутых Kotlin-потребителей: `backend-kt/identity-gateway`, `backend-kt/documentation-service`, `backend-kt/authorization-core` и корневые `backend-kt` architecture tests.
- [x] 8.3 Проверить `docker compose config`, собрать образ `ds-service`, поднять локальный контур и выполнить smoke-тесты health/readiness, RBAC, полного route manifest и конфигурации отката.
- [x] 8.4 Если изменены файлы в `js/`, выполнить релевантные тесты пакета и `cd js && npm run build`; если изменены `schema.ts` или Express routes, отдельно выполнить предусмотренные `db:generate` и `/sync-all`, не создавая миграцию без изменения схемы.
- [x] 8.5 Выполнить `tools/verify fast --change migrate-db-service-to-kotlin-ds-service`, устранить ошибки и получить независимое read-only ревью по workflow.
- [x] 8.6 После устранения подтверждённых замечаний повторить релевантные тесты и FAST, затем выполнить `tools/verify full --change migrate-db-service-to-kotlin-ds-service`.

## 9. Внешние проверки до архивации

- [x] 9.1 [внешняя проверка] На актуальной обезличенной копии существующей БД выполнить schema fingerprint, Flyway baseline/validate и сравнение схемы; приложить успешный лог без credentials и schema diff без расхождений.
- [x] 9.3 [внешняя проверка] В интеграционном окружении развернуть оба сервиса, подтвердить отсутствие двойных записей, выполнить атомарный cutover и rollback smoke-набора и приложить статусы, метрики ошибок и время обеих операций.

## 10. Совместимость с `feature/projects-workflow`

- [x] 10.1 Обновить route manifest, HTTP fixtures и дифференциальный набор по актуальному `db-service`: DTO профилей и preview тем, `editRevision`, агрегаты дизайн-систем и `PUT /tenants/{id}/token-values`.
- [x] 10.2 Добавить Flyway-миграцию после baseline для `tenants.edit_revision` и регистронезависимой уникальности нормализованного имени темы; расширить fingerprint и интеграционные проверки существующей БД.
- [x] 10.3 Реализовать в `feature-themes` domain/application/data/presentation контракты профиля, custom palette, preview, нормализации имени и conflict mapping без нарушения project ownership/RBAC.
- [x] 10.4 Реализовать отдельные use case и порты инициализации определений токенов дизайн-системы и начальных значений новой темы в согласованной транзакции.
- [x] 10.5 Реализовать отдельный `SaveTenantTokenValuesUseCase`, DTO и `PUT /tenants/{id}/token-values` с блокировкой темы, проверкой принадлежности токенов, заменой значений и optimistic concurrency.
- [x] 10.6 Добавить unit, repository/PostgreSQL и Ktor route-тесты профилей, preview, инициализации, `TENANT_NAME_CONFLICT`, `TENANT_EDIT_CONFLICT`, ownership и отсутствия частичной записи.
- [x] 10.7 Выполнить дифференциальные тесты и релевантные Gradle/JS проверки актуального контракта, затем FAST, независимое review и FULL по workflow.
