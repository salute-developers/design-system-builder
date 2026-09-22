## 1. Gradle и модульный scaffold

- [x] 1.1 Добавить `backend-kt/monolith/app` с application/Ktor plugins, convention.detekt, convention.spotless и единственным `EngineMain` entrypoint.
- [x] 1.2 Подключить `:monolith:app` и явные dependency substitutions Identity, Projects и Documentation feature/core modules в `backend-kt/settings.gradle.kts`.
- [x] 1.3 Добавить в monolith app прямые зависимости на все используемые feature/core modules и необходимые Ktor, Koin, Exposed, Flyway, PostgreSQL и AWS runtime libraries.
- [x] 1.4 Добавить compile smoke test, подтверждающий разрешение composite dependencies без публикации included builds.

## 2. Переиспользуемые Kotlin capability contracts

- [x] 2.1 Преобразовать Identity route registration в публичный переиспользуемый `Route` API без владения engine, общими plugins и общим `/health`, сохранив standalone Auth Helper app.
- [x] 2.2 Определить публичные Identity application ports/DTO для project context и project access-key verification с русским KDoc и без Ktor/HTTP типов.
- [x] 2.3 Добавить в Projects публичный `ProjectAuthorizationService`, который инкапсулирует effective-role и access-key use cases, оставляя реализации и persistence details internal.
- [x] 2.4 Добавить in-process Identity adapters к `ProjectAuthorizationService` и подключить их в monolith DI вместо HTTP adapters.
- [x] 2.5 Преобразовать Projects route registration в публичный переиспользуемый `Route` API без владения engine, общими plugins и общим `/health`, сохранив standalone Projects app.
- [x] 2.6 Извлечь Documentation infrastructure assembly, Flyway, S3, search и worker wiring из `documentation-service/app` в публичный переиспользуемый runtime/DI module.
- [x] 2.7 Добавить единый Documentation `Route` registration API и lifecycle handle для worker/clients/resources, используемые standalone app и monolith app.
- [x] 2.8 Добавить unit tests преобразований Identity ↔ Projects contract и подтвердить эквивалентность allowed, denied, invalid-key и unavailable outcomes существующему HTTP flow.
- [x] 2.9 Обновить route/runtime tests Identity, Projects и Documentation, подтверждая отсутствие feature-owned global health routes и работоспособность standalone apps.

## 3. Единый Ktor application

- [x] 3.1 Добавить единый `application.yaml` monolith с секциями Identity, Projects, Documentation и `integrations.dbService`, включая internal port `8081` и environment overrides.
- [x] 3.2 Реализовать monolith composition root с однократной установкой DefaultHeaders, CallLogging, ContentNegotiation и Koin.
- [x] 3.3 Собрать capability runtime objects и единый Koin graph с qualifiers для нескольких Database, HttpClient и других однотипных infrastructure dependencies.
- [x] 3.4 Зарегистрировать Identity, Projects и Documentation routes в одном Ktor routing tree без конфликтов paths, `/health` и OpenAPI endpoints.
- [x] 3.5 Реализовать monolith startup order для Projects schema initialization, Documentation Flyway/S3 runtime и Documentation worker.
- [x] 3.6 Реализовать graceful shutdown monolith, отменяющий worker и закрывающий HTTP, S3 и persistence resources в ограниченное время.
- [x] 3.7 Добавить `/health/live` и агрегированный `/health/ready` для Kotlin runtime, Projects database, Documentation database/storage и worker.
- [x] 3.8 Добавить Ktor integration tests единого engine для Identity auth routes, Projects routes, Documentation routes, readiness и trusted actor propagation.
- [x] 3.9 Добавить тест, подтверждающий, что Identity authorization вызывает Projects in-process contract и не выполняет HTTP-запрос к `/internal/projects/**`.

## 4. Direct db-service integration

- [x] 4.1 Сделать listen host `db-service` конфигурируемым и использовать `127.0.0.1` в monolith container, не меняя legacy standalone default без явной миграции.
- [x] 4.2 Настроить Documentation `DB_SERVICE_BASE_URL` на `http://127.0.0.1:3008` в monolith configuration и сохранить существующий trusted actor header contract.
- [x] 4.3 Добавить/обновить tests `DbServiceOwnershipVerifier` для loopback base URL, отсутствия `Authorization`, передачи user/project-key context и обработки timeout/5xx.
- [x] 4.4 Добавить Node tests конфигурируемого host и project scope filtering для trusted `X-Project-*`/`X-System-Admin` headers без изменения Drizzle schema.
- [x] 4.5 Проверить, что monolith не содержит прямых JDBC/SQL обращений к database, принадлежащей `db-service`.

## 5. nginx и единый container image

- [x] 5.1 Добавить monolith nginx template, направляющий Auth Helper, Projects и Documentation upstreams на `127.0.0.1:8081`, а `db-service` — на `127.0.0.1:3008`.
- [x] 5.2 Сохранить и покрыть smoke tests существующие public paths, auth_request, trusted-header sanitization, CORS, rate limits, upload limits, timeouts и блокировку `/internal/**`.
- [x] 5.3 Добавить корневой multi-stage `Dockerfile.monolith`, собирающий `:monolith:app:shadowJar` и production distribution `js/services/db-service` и создающий runtime с JRE 17, Node.js 22, nginx и init/supervision tooling.
- [x] 5.4 Добавить fail-fast supervisor entrypoint: unexpected exit nginx, Kotlin или Node MUST завершать остальные процессы и container с ненулевым code.
- [x] 5.5 Добавить container healthcheck для nginx, Kotlin liveness/readiness и Node health и направить логи всех процессов в stdout/stderr.
- [x] 5.6 Ограничить публикацию container port значением `8080` и проверить недоступность ports `8081` и `3008` из другого container.
- [x] 5.7 Добавить Docker smoke tests для graceful SIGTERM, аварийного завершения каждого child process и aggregate health failure.

## 6. Новый Docker Compose contour и запуск

- [x] 6.1 Добавить корневой `docker-compose.monolith.yml` с monolith backend, Keycloak/bootstrap, отдельными PostgreSQL services для db-service/Projects/Documentation и MinIO/init.
- [x] 6.2 Добавить one-shot Drizzle migration service/command, завершающийся до запуска backend, без автоматического production seed.
- [x] 6.3 Добавить `.env.monolith.example` со всеми ports, database, Keycloak, S3, JVM/Node memory и registry image variables без секретов.
- [x] 6.4 Добавить корневой `start-monolith.sh` с build/start, `--detach`, `--no-build`, `--down` и `--logs`, изолированным Compose project name и проверкой обязательных инструментов.
- [x] 6.5 Добавить ожидание readiness и понятную диагностику startup failure в `start-monolith.sh`.
- [x] 6.6 Проверить, что новый script и compose не изменяют старые containers, networks, volumes, Dockerfiles, compose и start scripts.
- [x] 6.7 Добавить smoke flow локального contour: Keycloak bootstrap, user/project authorization, Projects API, db-service API и Documentation upload/read/search.

## 7. Image delivery и эксплуатационная документация

- [x] 7.1 Добавить backend monolith image в GitHub Actions matrix с root build context и политиками тегов `dev`, `release` и `release_*`.
- [x] 7.2 Сохранить legacy image definitions и запретить monolith deploy trigger при ошибке build/push нового image.
- [x] 7.3 Добавить production monolith compose/configuration, использующие только registry image и внешние Keycloak, PostgreSQL и S3 endpoints без checkout/build на server.
- [x] 7.4 Документировать topology, environment variables, public/internal ports, migrations, health semantics, supervisor behavior, resource limits, rollout и rollback.
- [x] 7.5 Обновить repository/OpenSpec architecture context, отметив `project-publisher` и JS generator/publisher/documentation-generator deprecated и исключёнными из monolith runtime.

## 8. Проверка и приёмка

- [x] 8.1 Выполнить `cd backend-kt && ./gradlew build` и отдельные builds Identity, Projects и Documentation included builds.
- [x] 8.2 Выполнить detekt, spotlessCheck и tests для изменённых Kotlin builds; при formatting-only ошибках применить spotlessApply и повторить проверки.
- [x] 8.3 Выполнить build и tests `js/services/db-service`, не генерируя Drizzle migration при отсутствии schema changes.
- [x] 8.4 Собрать `Dockerfile.monolith` без build cache и проверить versions/runtime users, отсутствие dev secrets и запуск от непривилегированного пользователя там, где это совместимо с nginx binding.
- [x] 8.5 Запустить `docker compose -f docker-compose.monolith.yml config` и полный локальный smoke contour с чистыми volumes.
- [x] 8.6 Проверить регрессию публичных REST paths, HTTP statuses, trusted headers, ProjectKey scopes, large documentation upload и существующих API clients относительно legacy contour.
- [x] 8.7 Зафиксировать результаты memory/GC/load test одного JVM, выбрать container/JVM/Node limits и проверить отсутствие restart loop при временной недоступности внешних integrations.
- [x] 8.8 Выполнить `openspec validate add-backend-monolith-deployment --strict` и устранить ошибки artifacts/spec scenarios перед применением change.

## 9. Gateway parity и administrative security boundary

- [x] 9.1 Восстановить exact mappings `/auth/token`, `/auth/logout`, `/auth/account`, согласованное поведение login/register и legacy Keycloak rate-limit/forwarded-header/TLS-SNI semantics.
- [x] 9.2 Явно заблокировать `/admin`, `/admin/**`, `/api/admin` и `/api/admin/**` без проксирования в Keycloak или `db-service` и зафиксировать security-исключение в ADR/OpenSpec.
- [x] 9.3 Восстановить `308` redirect `/api/projects/`, CORS header hiding и Documentation buffering/request-id/header/body/timeout semantics.
- [x] 9.4 Перевести nginx contract test на отрендеренный config и покрыть exact auth mappings, admin blocks, trusted-header clearing, redirect и Documentation semantics.
- [x] 9.5 Расширить public regression test проверками auth compatibility, недоступности admin routes и trailing-slash redirect.
