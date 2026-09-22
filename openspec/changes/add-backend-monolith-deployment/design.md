## Context

Backend DS Builder сейчас состоит из nginx gateway, Auth Helper, Projects Service, Documentation Service и `db-service`, которые собираются и запускаются как отдельные приложения. Kotlin-сервисы уже разделены на feature-модули, но их `app`-модули одновременно владеют Ktor engine, DI bootstrap, infrastructure initialization и health routes. Это создаёт несколько deployment units и дублирует JVM/Ktor runtime, хотя Identity, Projects и Documentation должны выпускаться и работать совместно.

Целевой runtime должен сохранить публичные route namespaces и gateway authorization semantics. Keycloak остаётся внешней интеграцией: локальный contour поднимает его через Docker Compose, а dev/prod получают URL внешнего приложения. PostgreSQL и S3-compatible storage также остаются внешними ресурсами. `js/services/db-service` остаётся отдельным Node.js-процессом и source of truth конфигурационной модели компонентов.

Старые `app`, Dockerfile, compose и scripts должны оставаться рабочими на период миграции. `project-publisher` и JS `generator`, `publisher`, `documentation-generator` не входят в новый monolith runtime.

## Goals / Non-Goals

**Goals:**

- Создать `backend-kt/monolith/app` с одним Ktor engine и одним `Application` для Identity, Projects и Documentation routes.
- Сделать monolith единственным composition root общих Ktor plugins, Koin graph, infrastructure startup, background workers, health и graceful shutdown.
- Организовать прямое типизированное взаимодействие Kotlin capabilities через application contracts без HTTP и nginx.
- Сохранить `db-service` отдельным процессом и обращаться к нему напрямую по loopback HTTP с trusted actor context.
- Сохранить nginx как публичную trust boundary и исключить его из internal service-to-service traffic.
- Поставлять nginx, Kotlin monolith и `db-service` одним Docker image/container с fail-fast lifecycle.
- Добавить отдельный monolith compose и start script, не изменяя способ запуска legacy contour.
- Сохранить внешнее поведение существующих REST endpoints и authorization rules.

**Non-Goals:**

- Перенос gateway routing, rate limiting, CORS, Keycloak proxy и trusted-header normalization из nginx в Ktor.
- Перенос `db-service` или его PostgreSQL schema в Kotlin.
- Объединение Projects, Documentation и `db-service` persistence schemas или транзакций.
- Удаление старых service `app`, Dockerfile, compose, scripts и CI jobs в рамках первой миграции.
- Возвращение deprecated `project-publisher`, `generator`, `publisher` или `documentation-generator` в новый runtime.
- Изменение публичных API, project roles, access-key scopes или documentation contracts.

## Decisions

### 1. Один Ktor engine и один composition root

`backend-kt/monolith/app` запускает один Netty engine на внутреннем порту `8081`. Общие `DefaultHeaders`, `CallLogging`, `ContentNegotiation`, Koin и health routes устанавливаются один раз. Identity, Projects и Documentation предоставляют функции конфигурации `Route`, DI/runtime factories и lifecycle handles, но не устанавливают engine и не регистрируют собственный общий `/health`.

Monolith использует единый `application.yaml` с разделами `identity`, `projects`, `documentation` и `integrations.dbService`. Несколько databases и HTTP clients регистрируются с явными Koin qualifiers либо остаются полями capability runtime objects, чтобы исключить неоднозначные bindings.

Альтернатива — несколько embedded Ktor engines в одной JVM. Она сохраняет больше существующего bootstrap, но дублирует Netty runtime, порты и health semantics и оставляет микросервисную композицию внутри одного процесса. Поскольку feature-модули уже отделены от engine, выбран один `Application`.

### 2. Composite build подключается через dependency substitution

Основной `backend-kt/settings.gradle.kts` включает `:monolith:app` как subproject и сохраняет Identity, Projects и Documentation как independent included builds. Для потребляемых feature/core projects задаются явные module coordinates и dependency substitutions. `monolith:app` зависит от feature/core/runtime artifacts, но не от старых service `app`.

Documentation bootstrap, который сейчас приватно собирается в `documentation-service/app`, извлекается в переиспользуемый runtime/DI module. Старый Documentation app и новый monolith используют одну фабрику, чтобы не дублировать Flyway, Exposed, S3, search и worker wiring.

Альтернатива — преобразовать весь `backend-kt` в один multi-project build. Это упростило бы project dependencies, но резко увеличило бы migration scope и лишило бы сервисы независимых build entrypoints до завершения перехода.

### 3. Kotlin capabilities взаимодействуют через application contracts

Identity не вызывает Projects через HTTP. Projects предоставляет узкий публичный `ProjectAuthorizationService`, который инкапсулирует существующие use cases проверки effective role и access key. Identity предоставляет публичные application ports для project context и project access-key verification, а monolith DI связывает их с in-process adapters.

Presentation, data и persistence классы одного capability не импортируются другим capability. Cross-capability adapters размещаются в composition/integration layer monolith либо в отдельном DI-модуле и зависят только от публичных application contracts и DTO.

Trusted actor после единственной проверки внешнего credential представляется типизированным context object и явно передаётся в use cases. Переход на прямые вызовы устраняет повторную JWT-аутентификацию, но не отменяет business authorization по project role, ownership и scopes.

Альтернатива — self-HTTP к `/internal/projects/**` на том же Ktor engine. Она пригодна как краткоживущий migration fallback, но не является целевым состоянием из-за сериализации, timeout/error mapping и internal API key внутри одного процесса.

### 4. `db-service` остаётся отдельной process/API boundary

Kotlin monolith обращается к `db-service` по `http://127.0.0.1:3008`, а не через nginx. Существующий Documentation ownership adapter продолжает передавать нормализованные `X-Actor-*` и `X-Project-*` headers без исходного `Authorization`. `db-service` слушает loopback interface в monolith container; порт `3008` не публикуется и недоступен другим containers.

На первом этапе используется существующий REST resource contract. Новый internal endpoint вводится только если потребуется отделить внутренние DTO от публичного design-system representation. Internal API key может быть добавлен как defense-in-depth, но основной security boundary — loopback binding и отсутствие публикации порта.

Альтернатива — прямой доступ Kotlin к таблицам `db-service`. Она отклонена, потому что нарушает ownership JS schema, дублирует Drizzle model и позволяет обходить scope filtering.

### 5. nginx остаётся единственной публичной точкой входа

nginx слушает `8080` и направляет все Kotlin upstreams на `127.0.0.1:8081`, а `db-service` upstream — на `127.0.0.1:3008`. `auth_request` вызывает internal Identity route в том же monolith. Identity проверяет JWT через внешний Keycloak/JWKS и вызывает Projects authorization contract напрямую.

nginx продолжает удалять client-provided trusted headers, проксировать только нормализованный context, блокировать `/internal/**`, применять CORS, rate limits, body limits, timeouts и path rewrites. Только `8080` публикуется из container.

Для параллельного rollout используется отдельный monolith nginx template: его upstream topology отличается от legacy gateway, но public/auth/CORS contracts совпадают и проверяются после `envsubst` по полностью отрендеренному конфигу. В monolith допускаются только два класса отличий: loopback upstreams и явно исключённые administrative routes. Это уменьшает риск расхождения без связывания двух одновременно эксплуатируемых Docker build contexts общими runtime include-файлами.

Маршруты `/admin`, `/admin/**`, `/api/admin` и `/api/admin/**` намеренно возвращают `404` и не проксируются ни в Keycloak, ни в `db-service`. Это security-исключение из цели сохранить публичные paths: административная поверхность не должна автоматически переноситься в новый consolidated deployment.

Альтернатива — перенести gateway в Ktor и оставить два прикладных процесса. Она отклонена для первой версии из-за большого security-sensitive rewrite и отсутствия deployment-выгоды, сопоставимой с риском.

### 6. Один image содержит три обязательных процесса

Корневой `Dockerfile.monolith` использует multi-stage build для Kotlin shadow JAR и production `db-service` distribution. Runtime содержит JRE 17, Node.js 22, nginx и минимальный init/supervision runtime.

PID 1 корректно обрабатывает signals и reaping. Supervisor запускает nginx foreground, Kotlin monolith и Node `db-service`; неожиданное завершение любого процесса приводит к SIGTERM остальных, ограниченному graceful shutdown и ненулевому exit container. Внутренние процессы пишут логи в stdout/stderr.

Container healthcheck проверяет nginx, monolith liveness/readiness и `db-service`. Отрицательный readiness не подменяет process supervision: restart policy применяется после завершения container, а orchestration health policy отвечает за зависшие, но не завершившиеся процессы.

### 7. Новый compose изолирован от legacy contour

Корневой `docker-compose.monolith.yml` поднимает monolith backend и локальные внешние интеграции: Keycloak/bootstrap, отдельные PostgreSQL databases для `db-service`, Projects и Documentation, а также MinIO/init. Раздельные databases сохраняются в первой версии, чтобы не расширять change миграцией persistence topology.

Новый `start-monolith.sh` поддерживает build/start, detached mode, `--no-build`, `--down` и `--logs`, использует отдельный env example и не вызывает/не изменяет старые start scripts. Compose ожидает readiness обязательных init services и не включает deprecated runtime.

Dev/prod могут использовать тот же monolith image с внешними Keycloak, PostgreSQL и S3 endpoints; локальные integration containers не являются частью production image.

### 8. Миграции сохраняют ownership

Documentation продолжает выполнять Flyway migrations своего хранилища, Projects временно сохраняет текущую schema initialization до отдельной миграции на versioned migrations, а Drizzle migrations `db-service` выполняются отдельным one-shot compose/deployment step до запуска backend process. Seed operations не выполняются автоматически при каждом production startup.

Новый runtime не создаёт общей транзакционной границы между тремя databases.

### 9. Параллельная поставка и обратимость

Новый monolith image добавляется в image delivery с действующей политикой `dev`, `release` и versioned tags. Legacy images и compose остаются до отдельного решения об их удалении. Monolith compose использует отдельное имя image/service, поэтому оператор может откатиться на существующий deployment без преобразования данных.

## Risks / Trade-offs

- [Единый JVM heap позволяет Documentation workload влиять на latency Identity/Projects] → Ввести memory/load tests, ограничить archive sizes, наблюдать GC и сохранить строгие documentation worker limits.
- [Падение любого обязательного процесса останавливает весь backend] → Это намеренная atomic lifecycle semantics; настроить container restart policy и graceful shutdown timeout.
- [Несколько databases и SDK clients создают неоднозначные DI bindings] → Использовать capability runtime objects и именованные qualifiers, запретить unqualified bindings общих infrastructure types.
- [Публичные trusted headers могут быть подделаны при прямом доступе к Node] → Привязать Node только к `127.0.0.1`, не публиковать `3008`, очищать/перезаписывать headers в nginx и проверять runtime configuration тестами.
- [Отдельные legacy и monolith nginx templates могут расходиться] → Зафиксировать общие public/auth/CORS semantics в rendered-config contract test; изменения monolith ограничить upstream topology и явно документированными security-исключениями.
- [Composite substitutions могут расходиться с standalone builds] → Задать явные substitutions, сохранить independent service builds в CI и добавить сборку `:monolith:app:shadowJar` из корневого build.
- [Разная JSON-конфигурация существующих apps изменит parsing semantics] → Зафиксировать единый serialization contract и добавить regression tests на существующие request/response DTO.
- [Documentation runtime extraction сломает standalone app] → Старый app должен использовать тот же извлечённый runtime factory; обе точки входа проверяются тестами.
- [Один image увеличит размер и свяжет security updates JRE/Node/nginx] → Использовать pinned runtime versions, multi-stage build и единый регулярный image rebuild.
- [Compose healthcheck сам по себе не гарантирует restart в plain Docker Compose] → Crash обрабатывает supervisor; зависания документируются как ответственность deployment orchestrator или последующего watchdog.

## Migration Plan

1. Выделить публичные route/runtime/application contracts, сохранив старые service apps и их тесты.
2. Добавить composite substitutions и `monolith:app`, собрать единый Koin graph и Ktor engine.
3. Перевести Identity → Projects на in-process adapter и проверить эквивалентность authorization decisions.
4. Настроить direct loopback Documentation → `db-service`, loopback binding Node и nginx upstreams.
5. Добавить root Dockerfile, supervisor, aggregate healthcheck, monolith compose, env example и start script.
6. Прогнать unit/integration/smoke tests обоих contours, включая trusted-header spoofing, large documentation upload и process failure.
7. Добавить monolith image в CI и развернуть параллельный dev environment.
8. Переключить dev traffic после сравнения API/health/logs; затем повторить для production.
9. При rollback вернуть traffic на legacy compose/images; databases и публичные contracts не требуют обратной миграции.
10. Удаление legacy deployment оформить отдельным change после периода наблюдения.

## Open Questions

- Должен ли production deployment использовать отдельный compose-файл или override нового `docker-compose.monolith.yml` только с внешними integration URLs?
- Нужен ли watchdog, завершающий container при длительном отрицательном readiness, или это полностью ответственность Coolify/deployment orchestrator?
- Должен ли `db-service` получить отдельный internal ownership endpoint и `X-Internal-Api-Key` в первой версии либо после стабилизации monolith?
- Какой общий container memory limit и JVM `-Xms`/`-Xmx` профиль принимаются для dev и prod после load tests?
