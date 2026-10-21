## 1. Хранилище и модель данных (backend-kt/ds-service)

- [x] 1.1 Добавить миграцию Flyway `V8__compose_preview_plugin_builds.sql`: таблица билдов и уникальный частичный индекс на активный билд платформы; не менять `schema-fingerprint.json` базовой схемы
- [x] 1.2 Добавить в каталог версий `software.amazon.awssdk:s3` (версия как в `documentation-service`) и подключить к `feature-components`
- [x] 1.3 Домен: `PluginBuild`, `PublishOutcome`, правила проверки manifest (поля, `version = commit.take(12)`, sha256 меты, `entrypoint`)
- [x] 1.4 Application: порты `PluginBuildStorage` и `PluginBuildRepository`, use case публикации и use case выдачи адреса активного билда
- [x] 1.5 Data: безопасная распаковка архива с лимитами (размер, объём, число файлов, пути), таблица расширений и типов содержимого
- [x] 1.6 Data: S3-адаптер `PluginBuildStorage` (endpoint, регион, path-style, бакет, ключи, префикс), загрузка с `Content-Type` и `Cache-Control`, список и удаление префикса
- [x] 1.7 Data: Exposed-репозиторий билдов; `publish` выполняет в одной транзакции импорт меты (через существующую логику `ExposedApiMetaRepository`), вставку строки, снятие и установку признака активности; транзакции через `TransactionRunner` (`required`, для пробной отправки `rollback`); запись в журнал дизайн-системы не делается
- [x] 1.8 Очистка: оставить активный билд и N последних, удалить остальные и осиротевшие префиксы старше срока; ошибки только в лог
- [x] 1.9 Конфигурация `DS_PLUGIN_S3_*`, `DS_PLUGIN_PUBLIC_BASE_URL`, лимиты архива, число хранимых билдов; ответ `503` без настройки
- [x] 1.10 Presentation: `POST /api/admin/compose-preview/plugin-builds` (multipart, `dryRun` по умолчанию `true`, проверка роли до чтения тела, итоги `published`, `activated`, `unchanged`, `409 BUILD_CONTENT_CHANGED`) и `GET /api/projects/{projectId}/ds/compose-preview/plugin` с правом `components:read`
- [x] 1.11 DI, обновление `openapi/documentation.yaml`, манифеста маршрутов и аудита потребителей в `contracts`

## 2. Авторизация CI (backend-kt/identity-gateway)

- [x] 2.1 Добавить `GlobalRole.COMPOSE_PREVIEW_PUBLISHER("compose_preview_publisher")` и доверенный заголовок `X-Compose-Preview-Publisher` в `TrustedHeaders`; сопоставление роли в `KeycloakJwtVerifier`
- [x] 2.2 Тест `KeycloakJwtVerifier` на токене service account: issuer и audience проверяются как для пользователя, `sub` задан, `email` отсутствует (допустимо), роль берётся из `realm_access`; для клиента публикации добавить audience mapper в realm, чтобы токен проходил проверку audience
- [x] 2.3 Gateway: `location = /api/admin/compose-preview/plugin-builds` с лимитом тела под архив и `auth_request /_auth_user`, передача заголовка роли; повторить для маршрута защиту соседних маршрутов (`limit_req`, `limit_conn ds_route_connections`); обновить шаблоны nginx (prod и local) и smoke-проверки
- [x] 2.4 Keycloak: клиент `dsbuilder-preview-publisher` и роль `compose_preview_publisher` в `dsbuilder-realm.json`, `dsbuilder-realm.prod.json` и `bootstrap-production-keycloak.sh`
- [x] 2.5 ds-service: разрешить публикацию по `X-Compose-Preview-Publisher` или `X-System-Admin`, прочие маршруты оставить без изменения прав; передать признак роли в `ProjectPrincipal` через `TrustedProjectPrincipalFactory` (`authorization-core`) и `TrustedDsRequestContextMapper`
- [x] 2.6 Описать выдачу и ротацию секрета служебной учётки (production) в `backend-kt/DEPLOY.md`

## 3. CLI (frontend-kt)

- [x] 3.1 Домен и application: чтение `preview-plugin.json` и `api-meta.json` из zip, расчёт sha256, проверка соответствия, нормализация меты нормализатором `compose`
- [x] 3.2 Port и HTTP-источник: multipart-отправка архива и меты, разбор итога и отчёта, обработка `409 BUILD_CONTENT_CHANGED`
- [x] 3.3 Вход служебной учёткой: `client_credentials` через `/auth/token` по `DSBUILDER_CLIENT_ID` и `DSBUILDER_CLIENT_SECRET` (расширить `TokenExchangeClient`); токен не сохранять на диск; запрет секрета в аргументах; иначе сессия пользователя
- [x] 3.4 Presentation: команда `preview-plugin publish` (`--platform`, `--from`, `--api-url`, `--apply`), печать итога, адреса, отчёта импорта; DI
- [x] 3.5 Обновить `frontend-kt/cli/USAGE.md`: команда, переменные окружения служебной учётки, пример для CI
- [x] 3.6 Gradle-задача JVM-дистрибутива CLI (архив со стартовыми скриптами `dsbuilder`, Java 17) в `frontend-kt/cli`
- [x] 3.7 Workflow публикации релиза CLI: сборка JVM-дистрибутива и вложение в GitHub Release по тегу `cli-vX.Y.Z`; согласовать доступ на чтение релиза для CI `plasma-android`

## 4. Клиент (js/apps/client)

- [x] 4.1 API-клиент `GET .../compose-preview/plugin`: различие `404` и ошибок, кеш на время жизни страницы для проекта
- [x] 4.2 `resolveComposePreviewPluginUrl`: приоритет прямого адреса, запрос к бэкенду, возврат адреса или `undefined`
- [x] 4.3 Заменить условие включения (`getComposePreviewPluginUrl`) в `componentRepository.loadComposeComponentData` (`js/apps/client/src/api/componentRepository.ts`): при `404`/ошибке Compose-компоненты не запрашиваются, React-preview работает
- [x] 4.4 Подключить полученный адрес к `ComposePreviewFrame`/сессии, сообщение о недоступности при ошибке запроса
- [x] 4.5 Обновить `README.md` клиента: два источника адреса, приоритет прямого, локальная разработка, принятый риск общего origin; убрать прежнее требование отдельного origin
- [x] 4.6 Переменные: прямой адрес по умолчанию в `docker-compose.dev.yml` сохраняется; в workflows выкладки клиента отдельных переменных не требуется

## 5. Локальный контур и инфраструктура

- [x] 5.1 `backend-kt/docker-compose.local.yml`: переменные `DS_PLUGIN_S3_*` и `DS_PLUGIN_PUBLIC_BASE_URL` у `ds-service`, бакет плагина и публичное чтение через `mc` в `minio-init`
- [x] 5.2 Локальный realm: клиент и служебная учётка с известным dev-секретом для проверки публикации
- [ ] 5.3 Согласовать с владельцем инфраструктуры предложенные префиксы `dev/design-system-builder/compose-preview/` и `design-system-builder/compose-preview/` рядом с префиксами клиента, публичное чтение на них, CORS для origin клиентов dev и prom и ключ записи `ds-service`, ограниченный этим префиксом
- [ ] 5.4 Production: переменные S3 и публичный адрес для dev и prom, секрет служебной учётки передать команде `plasma-android`

## 6. Тесты

- [x] 6.1 ds-service, домен и распаковка: проверки manifest, лимитов, небезопасных путей, обязательных файлов, типов содержимого
- [x] 6.2 ds-service, репозиторий на PostgreSQL по образцу `ApiMetaImportHttpPostgresIntegrationTest`: публикация, активность одного билда, откат транзакции, идемпотентность, `activated`, конфликт, пробная отправка без записи, очистка
- [x] 6.3 ds-service, S3-адаптер: ключи, `Content-Type`, `Cache-Control`, листинг постранично, удаление каталога (против встроенного HTTP-сервера с протоколом S3; сбой заливки не меняет БД проверяет интеграционный тест публикации); проверка на настоящем MinIO входит в сквозную проверку 6.8
- [x] 6.4 ds-service, маршруты: роли публикации (служебная, сисадмин, обычный пользователь), ключ проекта, `503`, выдача адреса (успех, `404`, нет права)
- [x] 6.5 identity-gateway: сопоставление роли, заголовок, подделка заголовка снаружи, токен служебной учётки принят и не открывает прочие маршруты (импорт меты, проектные)
- [x] 6.6 CLI: проверка архива, нормализация, пробная отправка и `--apply`, вход служебной учёткой и сессией, запрет секрета в аргументах, печать итога и конфликта
- [x] 6.7 Клиент: Vitest на приоритет прямого адреса, `404`, ошибки, кеш; тесты `ComposePreviewFrame`; обновить существующие тесты `manifest`, `session`, `environment` и `themeEditorRepository.test.ts` (мок `getComposePreviewPluginUrl`) при изменении конфигурации; запрос адреса не должен передавать `versionId`
- [x] 6.8 Сквозная проверка на локальном контуре: zip из `plasma-android` отправляется командой CLI с служебной учёткой, мета появляется в БД, клиент показывает плагин из MinIO (проверено: пробная отправка и `--apply` дают `published`, строка в `compose_preview_plugin_builds`, `*.wasm` отдаются как `application/wasm`, повтор даёт `unchanged`, без входа и с неверным секретом отказ с подсказкой, `import-api-meta` служебной учётке — 403; клиент без прямого адреса получает адрес от бэкенда и читает `preview-plugin.json` из MinIO, меню групп строится по манифесту; сам кадр превью на локальных данных не поднялся: редактор отдаёт Compose-свойствам пустые `platformMappings`, это вне этого change; при проверке найден и исправлен `413` на подзапросе `/_auth_user` у gateway для архива больше 2 МБ)

## 7. Проверка и завершение

- [x] 7.1 `cd backend-kt && ./gradlew build`; `spotlessApply` для затронутых модулей, если `spotlessCheck` падает
- [x] 7.2 `cd backend-kt/identity-gateway && ./gradlew build` и smoke-проверки gateway
- [x] 7.3 `cd frontend-kt && ./gradlew build`
- [x] 7.4 `cd js/apps/client && npm run build && npm test`
- [x] 7.5 `./setup-local.sh`: применить `V8`, опубликовать плагин, открыть редактор и увидеть плагин; повторить публикацию того же билда (`unchanged`) и публикацию старого билда (`activated`)
