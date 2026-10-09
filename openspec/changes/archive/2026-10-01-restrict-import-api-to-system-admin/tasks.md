## 1. db-service: журнал без дизайн-системы

- [x] 1.1 В `js/services/db-service/src/db/schema.ts` убрать `.notNull()` у `designSystemChanges.designSystemId`; создать миграцию `npm run db:generate` (ожидается `ALTER COLUMN "design_system_id" DROP NOT NULL`) и убедиться, что она не трогает ничего другого
- [x] 1.2 Отразить необязательность колонки в `js/docs/db-schema.dbml` и в описании таблицы в `js/services/db-service/src/nl-query/schema-context.ts`; проверить, что публичный `POST /design-system-changes/` по-прежнему требует `designSystemId` (`validation/schema.ts` не меняется)
- [x] 1.3 Проверить потребителей `design_system_changes` (`routes/api/design-system-changes.ts`, `routes/api/design-systems.ts`, `queries/catalog.ts`) на `NULL`: ленты по дизайн-системе и «черновики» не должны включать записи без дизайн-системы

## 2. db-service: административная ручка

- [x] 2.1 Добавить в `js/services/db-service/src/routes/api/utils.ts` middleware `requireSystemAdmin`: пропускает только `X-System-Admin: true`, иначе `403` с сообщением о роли системного администратора, в том числе при отсутствии заголовка; стоит до разбора тела
- [x] 2.2 Перенести ручку в `js/services/db-service/src/routes/admin/component-config-import-api-meta.ts` (или аналогичное расположение рядом с `/admin/*`), смонтировать в `routes/index.ts` под `/admin/component-config` и удалить прежний роутер `routes/api/component-config-import-api-meta.ts` с его подключением под `/ds/component-config`
- [x] 2.3 Схема манифеста `db/import/apiMetaManifest.ts`: убрать `designSystemId`; `meta.source` трактовать как имя файла
- [x] 2.4 В `db/import/apiMetaImport.ts` убрать привязку к дизайн-системе, счётчик `createdLinks` и работу с `design_system_components`
- [x] 2.5 Запись журнала в той же транзакции: `design_system_id = NULL`, `entity_type = components:import-api-meta`, `entity_id` — новый uuid запуска, `data` — `userId` из `X-User-Id`, `platform`, `source`, `dryRun`, счётчики; `operation` — `created` при созданных компонентах или свойствах, иначе `updated`; dry run откатывает запись вместе с транзакцией
- [x] 2.6 Описать ручку и отчёт без `createdLinks` в `js/services/db-service/src/openapi/spec.ts` по новому пути; выполнить `/sync-all` один раз в конце правок; убедиться, что `js/apps/admin/src/api/types.gen.ts` регенерирован (поле `designSystemId` журнала стало необязательным)

## 3. db-service: тесты

- [x] 3.1 Обновить `apiMetaImport.test.ts`: убрать проверки привязок и `createdLinks`, добавить тест, что `design_system_components` не меняется; остальные сценарии (аддитивность, повтор, расхождения типа, несколько имён, порядок платформ) оставить
- [x] 3.2 Переписать `component-config-import-api-meta.test.ts` под административный маршрут: `X-System-Admin: true` проходит; `false` и отсутствие заголовка дают `403` до разбора тела; проектный маршрут отвечает `404`; тело без `designSystemId` принимается; `400` без платформенных имён
- [x] 3.3 Тесты журнала: `--apply` оставляет одну строку с `design_system_id IS NULL`, `userId` и счётчиками в `data`; dry run строку не оставляет; сбой транзакции откатывает и её; записи нет в ленте любой дизайн-системы (`/design-system-changes/by-design-system/:id`) и нет в `/design-systems/:id/changes`
- [x] 3.4 Тест на то, что `POST /design-system-changes/` по-прежнему требует `designSystemId`

## 4. gateway

- [x] 4.1 Для `location ~ ^/api/admin(/.*)?$` в `backend-kt/identity-gateway/gateway/nginx.local.conf` и `nginx.prod.conf.template` задать `client_max_body_size 16m;`, как у маршрута `ds`
- [x] 4.2 Если есть проверка конфигов (`gateway/test-route-namespaces.sh`), убедиться, что она проходит; добавить проверку, что `/api/admin` отвечает `401` на запрос с `Authorization: ProjectKey …`

## 5. frontend-kt: удаление пути через Gradle

- [x] 5.1 Удалить `Capability.API_META` из `core-platform/.../PlatformModels.kt`, ветки `API_META` из `AndroidGradleDelegate` (набор capability, карта задач, KDoc) и `IosCliDelegate` (`when`), вернуть тестам прежние наборы capability
- [x] 5.2 Удалить тесты `API_META` в `AndroidGradleDelegateTest` и `PlatformCommandsCliTest` (`compositionRootOffersApiMetaExtractionThroughTheAndroidDelegateOnly`)

## 6. frontend-kt: причина отказа

- [x] 6.1 В `core-network/.../AuthenticatedHttpClient.kt` при `401` и `403` дописывать к сообщению текст `error` или `message` из JSON-тела ответа (`Server: …`), усекая до лимита; пустое тело и тело без этих полей оставляют сообщение прежним
- [x] 6.2 Тесты в `core-network`: причина из `error`, причина из `message`, пустое тело, тело без полей, усечение длинной причины; существующие тесты остальных команд проходят без правок

## 7. frontend-kt: use case и data

- [x] 7.1 Заменить `PlatformApiMetaSource` и порт `ApiMetaSource` чтением локального файла (`WorkspaceFileSystem`): абсолютизация пути, отказ при отсутствии файла; удалить зависимость от `PlatformCapabilityRunner`
- [x] 7.2 Переписать `ImportApiMetaUseCase` без project context: явный API URL (`resolveForWrite`), credential `CredentialPolicy.USER_SESSION`, чтение файла, нормализация, цель, запрос; `ImportApiMetaCommand` получает обязательные `platform` и `from`, теряет `apiKeyOverride` и `toolOverride`; из `ImportApiMetaTarget` и результатов уходят `projectId` и `designSystemId`
- [x] 7.3 В `HttpApiMetaRemoteSource` отправлять на `POST /api/admin/component-config/import-api-meta` тело без `designSystemId` с `meta.source` — именем файла; из отчётной модели и её разбора убрать `createdLinks`
- [x] 7.4 Обновить Koin-wiring в `ComponentsApplicationModule`

## 8. frontend-kt: CLI

- [x] 8.1 В `ComponentsImportApiCliCommand`: обязательные `--from` и `--platform`, удалить `--tool` и `--api-key`; убрать из вывода `Project:`, `Design system:` и строку `Linked to the design system`; сообщение об отсутствии user session указывает на `dsbuilder auth login` для этого API URL

## 9. frontend-kt: тесты

- [x] 9.1 Переписать `ImportApiMetaUseCaseTest` под новый use case: отказы без явного API URL, без user session, неподдержанная платформа, отсутствующий и пустой файл, мета другой платформы, один запрос, `dryRun`, источник — имя файла, credential — user session и ключ игнорируется
- [x] 9.2 Обновить `HttpApiMetaRemoteSourceTest`: путь административного маршрута, тело без `designSystemId`, отчёт без `createdLinks`
- [x] 9.3 Переписать сквозные тесты `ComponentsImportApiCliCommandTest`: без `.sdds/config.json` и без процессов, чтение файла, user session через подмену `CredentialProvider`/хранилища, `--from` и `--platform` обязательны, `--tool` и `--api-key` отвергаются, отказ `403` показывает причину сервера, вывод без строк о проекте и привязках
- [x] 9.4 Удалить тесты, завязанные на проектный контекст и Gradle в `import-api` (`readUikit*`, `.sdds/config.json`, `Linked to the design system`)

## 10. Документация

- [x] 10.1 Переписать раздел «Импорт API компонентов» в `frontend-kt/cli/USAGE.md`: только системный администратор, `dsbuilder auth login` на тот же API URL, `--from`, `--platform`, источники файла (вывод генератора или плагина), примеры, отсутствие привязки к дизайн-системе, причина отказа; убрать упоминания scope `components:write`, Gradle-задач и `--tool`

## 11. Проверка

- [x] 11.1 `cd js && npm run build`, `cd js/services/db-service && npm test`, `/sync-all`; применить миграции на чистой базе и на копии рабочей, убедиться, что колонка стала необязательной и существующие записи не изменились
- [x] 11.2 `cd frontend-kt && ./gradlew build --continue` (spotless, detekt, тесты, native)
- [x] 11.3 Сквозная проверка на локальном контуре (сид, gateway, Keycloak) с файлом меты: пользователь `user@example.com` (не администратор) получает `403` с причиной; ключ проекта получает `401` на gateway; `admin@example.com` (`system_admin`): dry run без записи, `--apply`, повтор с нулями; в `design_system_changes` ровно одна строка с `design_system_id IS NULL`; ленты дизайн-систем без неё. Если `auth login` нельзя выполнить без интерактивного ввода, серверную часть проверить запросами с токеном пользователя, а CLI — тестами с подменой session
- [x] 11.4 Независимая сверка результата с метой своим скриптом: нет пропущенных свойств, алиасов и состояний; привязки `design_system_components` не изменились
