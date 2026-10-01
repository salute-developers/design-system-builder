## 1. db-service: контракт и запись

- [x] 1.1 Добавить zod-схему запроса `ApiMetaImportRequestSchema` (`designSystemId` uuid, `platform` из `xml|compose|ios|web`, `meta`, `dryRun`, `components[].{name, properties[].{name, type, platformName, description?}, states[]}`) в `js/services/db-service/src/db/import/` рядом с `commonConfig.ts`
- [x] 1.2 Реализовать `importApiMeta(tx, designSystemId, platform, components)` в `js/services/db-service/src/db/import/apiMetaImport.ts`: пакетные вставки с `ON CONFLICT DO NOTHING` по существующим уникальным индексам, чтение существующих строк для счётчиков, проверка типа по `propertyTypeEnum`, отчёт `created*`, `unchangedProperties`, `rejected`, `typeMismatches`
- [x] 1.3 Гарантировать аддитивность: не менять и не удалять существующие компоненты, свойства, состояния, алиасы и привязки; расхождение типа возвращать в `typeMismatches`
- [x] 1.4 Добавить роутер `js/services/db-service/src/routes/api/component-config-import-api-meta.ts`: `requireScope("components:write")` до разбора тела, проверка дизайн-системы через `designSystemScopeFilter` и `designSystemBelongsToScope`, транзакция, `dryRun` через откат, запись в `design_system_changes`, ответ `422` с логированием при сбое
- [x] 1.5 Подключить роутер в `js/services/db-service/src/routes/index.ts` под `/ds/component-config`
- [x] 1.6 Описать endpoint и отчёт в `js/services/db-service/src/openapi/spec.ts`; выполнить `/sync-all` один раз в конце правок и убедиться, что `js/apps/admin/src/api/types.gen.ts` регенерирован

## 2. db-service: тесты

- [x] 2.1 Тесты `apiMetaImport.test.ts` в стиле `componentImport.test.ts`: создание компонента со свойствами, состояниями, алиасами и привязкой; повторный импорт даёт нули; существующее не меняется, включая `description`
- [x] 2.2 Тесты на `typeMismatches` (тип существующего свойства не меняется, алиас создаётся) и на `rejected` для неизвестного типа (остальное импортируется)
- [x] 2.3 Тест dry run: отчёт совпадает с отчётом применения, данные и `design_system_changes` не сохраняются
- [x] 2.4 Тест роутера: `403` без scope до разбора тела, `404` для чужой дизайн-системы, `422` при сбое транзакции

## 3. frontend-kt: платформенный слой

- [x] 3.1 Добавить `Capability.API_META` в `core-platform/.../PlatformModels.kt` с меткой для сообщений пользователю; обновить места, где перечисляются capability
- [x] 3.2 В `platform-android/.../AndroidGradleDelegate.kt` объявить `API_META` и добавить пару `API_META × COMPOSE → readUikitComposeApiMeta` в карту задач; для `ANDROID_VIEW` возвращать `Unsupported`
- [x] 3.3 Тесты `AndroidGradleDelegate`: запуск задачи с `-p` и passthrough, `Unsupported` для `android-view` и для `--output`, результат завершения и сбоя
- [x] 3.4 Обновить тесты реестра делегатов и `toolchain list`, где проверяются объявленные capability

## 4. frontend-kt: домен и application

- [x] 4.1 В `feature-components/domain` добавить модель манифеста (`ApiMetaManifest`, компонент, свойство, состояние) и модель отчёта импорта меты
- [x] 4.2 Реализовать нормализатор меты Compose: дедупликация по `(component, id)`, описание `method/param` без `group`, `platformName = id`, состояния из `stateEnum` (`configName` или kebab-case из `name`), подмена типа `--map-type`, пропуск компонентов без параметров
- [x] 4.3 Описать порты `ApiMetaSource` (запуск делегата и чтение файла) и `ApiMetaRemoteSource` (отправка манифеста) в `feature-components/application`
- [x] 4.4 Реализовать `ImportApiMetaUseCase`: project context, явный API URL (`resolveForWrite`), credentials, проверка платформы (только `compose`), получение меты, нормализация, отправка, результат для команды; ранние возвраты до запуска Gradle
- [x] 4.5 Соответствие `TargetPlatform` значению `platform` запроса (`compose→compose`, `android-view→xml`, `swiftui→ios`, `react→web`) как чистая функция домена

## 5. frontend-kt: data и DI

- [x] 5.1 Адаптер `ApiMetaSource` поверх `PlatformCapabilityRunner` и `WorkspaceFileSystem`: запуск `API_META`, чтение `build/theme-builder/components/uikit-compose-api-meta.json`, отказ при отсутствии файла или пустом списке с ожидаемым путём в сообщении
- [x] 5.2 HTTP-адаптер `ApiMetaRemoteSource` в стиле `HttpComponentConfigRemoteSource`: `POST .../component-config/import-api-meta`, разбор отчёта, отказ при неразбираемом теле
- [x] 5.3 Подключить порты и use case в `ComponentsApplicationModule` и связанных Koin-модулях

## 6. frontend-kt: CLI

- [x] 6.1 Добавить `ComponentsImportApiCliCommand` (`import-api`): опции `--platform`, `--api-url`, `--api-key`, `--tool`, `--map-type` (повторяемая), `--apply`, `--dry-run`, `--strict`; явная ссылка на дизайн-систему (`--design-system`) не поддерживается, потому что для запуска Gradle нужна рабочая копия с `.sdds/config.json`; конфликт `--apply` и `--dry-run` как `UsageError`
- [x] 6.2 Печать цели до отправки (API URL и источник, `projectId`, `designSystemId`, платформа, путь файла меты, число компонентов и свойств) и отчёта (счётчики, `rejected`, `typeMismatches` только непустые); `--strict` завершает с кодом `1` при непустом `rejected`
- [x] 6.3 Зарегистрировать команду в `ComponentsCliCommand` и `ComponentsCliPresentationModule`; обновить `cli/USAGE.md`

## 7. frontend-kt: тесты

- [x] 7.1 Тест нормализатора на реальном `uikit-compose-api-meta.json` (в репозиторий кладётся уменьшенный фрагмент): 1263 уникальных свойства из 2315 параметров, отсутствие `group` в описании, состояния, `--map-type`
- [x] 7.2 Тесты `ImportApiMetaUseCase` на `MockEngine`: ранние отказы без запуска процесса, неподдержанная платформа, пустая мета, dry run и `--apply`, ошибка backend, неразбираемый отчёт
- [x] 7.3 Тесты HTTP-адаптера: путь и тело запроса (`designSystemId`, `platform`, `dryRun`, компоненты одним запросом), разбор отчёта
- [x] 7.4 Тест `ComponentsImportApiCliCommand` рядом с `ComponentsCliCommandTest`: help без project config, конфликт флагов, вывод отчёта без ключа

## 8. Удаление скрипта и документация

- [x] 8.1 Удалить `backend-kt/scripts/import-uikit-api-meta.sh` и убрать упоминание из описания `backend-kt/scripts/` в `openspec/config.yaml`
- [x] 8.2 Обновить `js/CLAUDE.md` и комментарий в `js/services/db-service/src/test/fixtures.ts`: слой заводит `dsbuilder components import-api`
- [x] 8.4 Заменить устаревшее имя `uikit-api-meta.json` на `uikit-compose-api-meta.json` в требованиях `component-state-model` и `component-appearance-model` (дельта `MODIFIED` в этом change с полным текстом затронутых требований) и в комментариях `js/services/db-service/src/db/seeds/state-sets.ts` и `js/services/db-service/src/db/schema.ts`: файл `uikit-api-meta.json` теперь принадлежит меты View (переименование Compose-файла — plasma-android `17bbec54c`, 2026-07-27)
- [x] 8.3 Описать порядок использования и ограничения (только `compose`, аддитивность, `typeMismatches`) в `cli/USAGE.md`

## 9. Проверка

- [x] 9.1 `cd js && npm run build`, `cd js/services/db-service && npm test`, применить миграции на чистой БД и убедиться, что новых миграций нет
- [x] 9.2 `cd frontend-kt && ./gradlew build`, `detekt`, `spotlessCheck`, тесты; при необходимости `spotlessApply` для затронутых модулей
- [x] 9.3 `cd backend-kt && ./gradlew build` после удаления скрипта
- [x] 9.4 Сквозная проверка на локальном контуре (`./setup-local.sh`) с проектом plasma-android: `dsbuilder components import-api` (dry run), затем `--apply`, затем повтор с `created*` равными нулю; убедиться, что после этого `components push` не выводит `unknownProperties` и `unknownStates` для компонентов меты
- [x] 9.5 Сверить результат с прежним скриптом на копии БД: набор компонентов, свойств и состояний совпадает, различие только в отсутствии `group` в описании новых свойств и в том, что типы существующих свойств не менялись
