## 1. Backend (репозиторий design-system-builder, сервис db-service)

- [x] 1.1 Добавить в `ImportRequestSchema` (`services/db-service/src/db/import/commonConfig.ts`) обязательное поле `designSystemId: z.string().uuid()`.
- [x] 1.2 Перевести хендлер импорта на путь `/import` и на общий `validateBody(ImportRequestSchema)`; идентификатор дизайн-системы читать из `req.body.designSystemId`, оставив прежние `designSystemScopeFilter` и `designSystemBelongsToScope`.
- [x] 1.3 Переименовать `services/db-service/src/routes/api/components-import.ts` в `component-config-import.ts` под новую точку монтирования; удалить `IMPORT_ACTION`, ветку `req.params.action !== IMPORT_ACTION`, шаблон `/:id/:action` и `mergeParams`.
- [x] 1.4 Смонтировать роутер импорта под `/ds/component-config` в `services/db-service/src/routes/index.ts` и удалить предваряющее `router.use("/ds/design-systems", componentsImportRouter)` вместе с комментарием про двоеточие.
- [x] 1.5 Обновить `registerPath` в `services/db-service/src/openapi/spec.ts`: путь `${DS_PREFIX}/component-config/import`, без `params`, тег `Component Config`, ответ 400 описывает и некорректный `designSystemId`.
- [x] 1.6 Оставить `entityType: "components:import"` в записи `design_system_changes` без переименования.
- [x] 1.7 Прогнать `/sync-spec` и `/sync-api-types` из корня `design-system-builder`, чтобы обновить `apps/admin/src/api/openapi.json` и `types.gen.ts`; сгенерированные файлы не редактировать руками.
- [x] 1.8 Убедиться, что в репозитории не осталось упоминаний `components:import` как пути: `grep -rn "components:import"` даёт только запись журнала изменений.

## 2. CLI dsbuilder

- [x] 2.1 Добавить `designSystemId` в `ImportRequest` (`dsbuilder-frontend/cli/src/commonMain/kotlin/com/dsbuilder/frontend/cli/feature/components/application/PushComponentsUseCase.kt`) с KDoc на русском.
- [x] 2.2 Заменить построение пути в `PushComponentsUseCase` на `/api/projects/${projectId}/ds/component-config/import` и передать `designSystemId` из `context.designSystemId` в тело запроса.
- [x] 2.3 Обновить KDoc `ImportRequest` («Тело запроса `components:import`») под новый контракт.

## 3. Тесты

- [x] 3.1 Обновить ожидаемый путь в `PushComponentsUseCaseTest` (`assertEquals` на полный путь и проверка `endsWith`), заменив их на проверку `/api/projects/{projectId}/ds/component-config/import`.
- [x] 3.2 Добавить в `PushComponentsUseCaseTest` проверку, что тело запроса содержит `designSystemId` из project config.
- [x] 3.3 Обновить путь-образец в `CliCoreWriteSupportTest`, чтобы в тестах не осталось адресов с двоеточием.

## 4. Верификация

- [ ] 4.1 `cd dsbuilder-frontend && ./gradlew build`. Сейчас падает на `DsBuilderCliTest.themeFetchWritesLocalFilesAndConfigTenants` (имя токена приходит с префиксом `dark.`). Падение воспроизводится на чистом дереве без правок этого change и относится к незавершённой работе `theme fetch` на ветке `feature/components-fetch`; зачесть задачу после её починки.
- [x] 4.2 `cd dsbuilder-frontend && ./gradlew :cli:detekt :cli:spotlessCheck` — зелено; `:cli:jvmTest` по затронутым классам (`PushComponentsUseCaseTest`, `CliCoreWriteSupportTest`, `ComponentsCliCommandTest`) — 33 теста, 0 падений.
- [x] 4.3 Прогнать `dsbuilder components push --dry-run` против локального стенда с обновлённым `db-service` и сверить отчёт с прежним поведением. Пакет `sdds_sbcom` (47 конфигураций) через gateway: `Unchanged: 46`, `Rejected: 1` (`bottom-sheet` отсутствует в глобальном слое), предупреждения по свойствам, состояниям и типам совпадают с описанными в `USAGE.md`.
- [x] 4.4 Проверить негативные случаи вживую: несуществующий `designSystemId` — 404 `Not found`, не-uuid — 400 `Invalid UUID`, пустое тело — 400 с перечислением полей, ключ без `components:write` — 403. Общая дизайн-система без `projectId` остаётся доступной проекту (200).
- [x] 4.5 Убедиться, что старый путь `/ds/design-systems/{id}/components:import` отвечает 404.
- [x] 4.6 Проверить запись в базу на стенде: `--apply` с изменённым значением даёт `Updated: 1`, `GET /ds/component-config` возвращает новое значение, в `design_system_changes` появляется запись; повторный `--apply` исходного пакета возвращает конфиг к прежнему состоянию.
