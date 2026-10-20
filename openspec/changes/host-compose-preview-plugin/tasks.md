## 1. Хранилище и модель данных (backend-kt/ds-service)

- [ ] 1.1 Добавить миграцию Flyway `V7__compose_preview_plugin_builds.sql`: таблица билдов и уникальный частичный индекс на активный билд платформы; не менять `schema-fingerprint.json` базовой схемы
- [ ] 1.2 Добавить в каталог версий `software.amazon.awssdk:s3` (версия как в `documentation-service`) и подключить к `feature-components`
- [ ] 1.3 Домен: `PluginBuild`, `PublishOutcome`, правила проверки manifest (поля, `version = commit.take(12)`, sha256 меты, `entrypoint`)
- [ ] 1.4 Application: порты `PluginBuildStorage` и `PluginBuildRepository`, use case публикации и use case выдачи адреса активного билда
- [ ] 1.5 Data: безопасная распаковка архива с лимитами (размер, объём, число файлов, пути), таблица расширений и типов содержимого
- [ ] 1.6 Data: S3-адаптер `PluginBuildStorage` (endpoint, регион, path-style, бакет, ключи, префикс), загрузка с `Content-Type` и `Cache-Control`, список и удаление префикса
- [ ] 1.7 Data: Exposed-репозиторий билдов; `publish` выполняет в одной транзакции импорт меты (через существующую логику `ExposedApiMetaRepository`), вставку строки, снятие и установку признака активности и запись журнала
- [ ] 1.8 Очистка: оставить активный билд и N последних, удалить остальные и осиротевшие префиксы старше срока; ошибки только в лог
- [ ] 1.9 Конфигурация `DS_PLUGIN_S3_*`, `DS_PLUGIN_PUBLIC_BASE_URL`, лимиты архива, число хранимых билдов; ответ `503 storage_not_configured` без настройки
- [ ] 1.10 Presentation: `POST /api/admin/compose-preview/plugin-builds` (multipart, `dryRun` по умолчанию `true`, проверка роли до чтения тела, итоги `published`, `activated`, `unchanged`, `409 build_content_changed`) и `GET /api/projects/{projectId}/ds/compose-preview/plugin` с правом `components:read`
- [ ] 1.11 DI, обновление `openapi/documentation.yaml`, манифеста маршрутов и аудита потребителей в `contracts`

## 2. Авторизация CI (backend-kt/identity-gateway)

- [ ] 2.1 Добавить `GlobalRole.COMPOSE_PREVIEW_PUBLISHER("compose_preview_publisher")` и доверенный заголовок `X-Compose-Preview-Publisher` в `TrustedHeaders`; сопоставление роли в `KeycloakJwtVerifier`
- [ ] 2.2 Тест `KeycloakJwtVerifier` на токене service account: issuer и audience проверяются как для пользователя, `sub` задан, `email` отсутствует (допустимо), роль берётся из `realm_access`; для клиента публикации добавить audience mapper в realm, чтобы токен проходил проверку audience
- [ ] 2.3 Gateway: `location = /api/admin/compose-preview/plugin-builds` с лимитом тела под архив и `auth_request /_auth_user`, передача заголовка роли; обновить шаблоны nginx (prod и local) и smoke-проверки
- [ ] 2.4 Keycloak: клиент `dsbuilder-preview-publisher` и роль `compose_preview_publisher` в `dsbuilder-realm.json`, `dsbuilder-realm.prod.json` и `bootstrap-production-keycloak.sh`
- [ ] 2.5 ds-service: разрешить публикацию по `X-Compose-Preview-Publisher` или `X-System-Admin`, прочие маршруты оставить без изменения прав; обновить `TrustedDsRequestContextMapper`
- [ ] 2.6 Описать выдачу и ротацию секрета служебной учётки (production) в `backend-kt/DEPLOY.md`

## 3. CLI (frontend-kt)

- [ ] 3.1 Домен и application: чтение `preview-plugin.json` и `api-meta.json` из zip, расчёт sha256, проверка соответствия, нормализация меты нормализатором `compose`
- [ ] 3.2 Port и HTTP-источник: multipart-отправка архива и меты, разбор итога и отчёта, обработка `409 build_content_changed`
- [ ] 3.3 Вход служебной учёткой: `client_credentials` через `/auth/token` по `DSBUILDER_CLIENT_ID` и `DSBUILDER_CLIENT_SECRET` (расширить `TokenExchangeClient`); токен не сохранять на диск; запрет секрета в аргументах; иначе сессия пользователя
- [ ] 3.4 Presentation: команда `preview-plugin publish` (`--platform`, `--from`, `--api-url`, `--apply`), печать итога, адреса, отчёта импорта; DI
- [ ] 3.5 Обновить `frontend-kt/cli/USAGE.md`: команда, переменные окружения служебной учётки, пример для CI
- [ ] 3.6 Gradle-задача JVM-дистрибутива CLI (архив со стартовыми скриптами `dsbuilder`, Java 17) в `frontend-kt/cli`
- [ ] 3.7 Workflow публикации релиза CLI: сборка JVM-дистрибутива и вложение в GitHub Release по тегу `cli-vX.Y.Z`; согласовать доступ на чтение релиза для CI `plasma-android`

## 4. Клиент (js/apps/client)

- [ ] 4.1 API-клиент `GET .../compose-preview/plugin`: различие `404` и ошибок, кеш на время жизни страницы для проекта
- [ ] 4.2 `resolveComposePreviewPluginUrl`: приоритет прямого адреса, запрос к бэкенду, возврат адреса или `undefined`
- [ ] 4.3 Заменить условие включения (`getComposePreviewPluginUrl`) в `themeEditorRepository.loadComposeComponents`: при `404`/ошибке Compose-компоненты не запрашиваются, React-preview работает
- [ ] 4.4 Подключить полученный адрес к `ComposePreviewFrame`/сессии, сообщение о недоступности при ошибке запроса
- [ ] 4.5 Обновить `README.md` клиента: два источника адреса, приоритет прямого, локальная разработка, принятый риск общего origin; убрать прежнее требование отдельного origin
- [ ] 4.6 Переменные: прямой адрес по умолчанию в `docker-compose.dev.yml` сохраняется; в workflows выкладки клиента отдельных переменных не требуется

## 5. Локальный контур и инфраструктура

- [ ] 5.1 `backend-kt/docker-compose.local.yml`: переменные `DS_PLUGIN_S3_*` и `DS_PLUGIN_PUBLIC_BASE_URL` у `ds-service`, бакет плагина и публичное чтение через `mc` в `minio-init`
- [ ] 5.2 Локальный realm: клиент и служебная учётка с известным dev-секретом для проверки публикации
- [ ] 5.3 Согласовать с владельцем инфраструктуры предложенные префиксы `dev/design-system-builder/compose-preview/` и `design-system-builder/compose-preview/` рядом с префиксами клиента, публичное чтение на них, CORS для origin клиентов dev и prom и ключ записи `ds-service`, ограниченный этим префиксом
- [ ] 5.4 Production: переменные S3 и публичный адрес для dev и prom, секрет служебной учётки передать команде `plasma-android`

## 6. Тесты

- [ ] 6.1 ds-service, домен и распаковка: проверки manifest, лимитов, небезопасных путей, обязательных файлов, типов содержимого
- [ ] 6.2 ds-service, репозиторий на PostgreSQL по образцу `ApiMetaImportHttpPostgresIntegrationTest`: публикация, активность одного билда, откат транзакции, идемпотентность, `activated`, конфликт, пробная отправка без записи, очистка
- [ ] 6.3 ds-service, S3-адаптер на MinIO: ключи, `Content-Type`, `Cache-Control`, удаление префикса; сбой заливки не меняет БД
- [ ] 6.4 ds-service, маршруты: роли публикации (служебная, сисадмин, обычный пользователь), ключ проекта, `503 storage_not_configured`, выдача адреса (успех, `404`, нет права)
- [ ] 6.5 identity-gateway: сопоставление роли, заголовок, подделка заголовка снаружи, токен служебной учётки принят и не открывает прочие маршруты (импорт меты, проектные)
- [ ] 6.6 CLI: проверка архива, нормализация, пробная отправка и `--apply`, вход служебной учёткой и сессией, запрет секрета в аргументах, печать итога и конфликта
- [ ] 6.7 Клиент: Vitest на приоритет прямого адреса, `404`, ошибки, кеш; тесты `ComposePreviewFrame`; обновить существующие тесты `manifest`, `session`, `environment` при изменении конфигурации
- [ ] 6.8 Сквозная проверка на локальном контуре: zip из `plasma-android` отправляется командой CLI с служебной учёткой, мета появляется в БД, клиент показывает плагин из MinIO

## 7. Проверка и завершение

- [ ] 7.1 `cd backend-kt && ./gradlew build`; `spotlessApply` для затронутых модулей, если `spotlessCheck` падает
- [ ] 7.2 `cd backend-kt/identity-gateway && ./gradlew build` и smoke-проверки gateway
- [ ] 7.3 `cd frontend-kt && ./gradlew build`
- [ ] 7.4 `cd js/apps/client && npm run build && npm test`
- [ ] 7.5 `./setup-local.sh`: применить `V7`, опубликовать плагин, открыть редактор и увидеть плагин; повторить публикацию того же билда (`unchanged`) и публикацию старого билда (`activated`)
