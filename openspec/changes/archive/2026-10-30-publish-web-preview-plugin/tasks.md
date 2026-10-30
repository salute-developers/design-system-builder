## 1. ds-service: платформа билда и хранилище

- [x] 1.1 Миграция Flyway: переименовать `compose_preview_plugin_builds.uikit_compose_version` в `library_version`; обновить `ComponentTables`
- [x] 1.2 `PreviewPluginPlatform` (`COMPOSE`, `WEB`) и `PluginManifest` с `platform` и `libraryVersion`
- [x] 1.3 `PluginManifestParser.parse(archive, platform)`: общие правила, `platform` и поле версии библиотеки по платформе (`uikitComposeVersion` / `plasmaNewHopeVersion`)
- [x] 1.4 Конфигурация: `DS_WEB_PLUGIN_S3_BUCKET`, `DS_WEB_PLUGIN_S3_PREFIX`, `DS_WEB_PLUGIN_PUBLIC_BASE_URL` поверх общих `DS_PLUGIN_*`; хранилище платформы считается настроенным только целиком
- [x] 1.5 `PluginBuildStorages`: хранилище и настройки по платформе; `S3PluginBuildStorage` с бакетом и префиксом платформы; DI

## 2. ds-service: публикация и выдача по платформе

- [x] 2.1 `PublishPluginBuildUseCase(platform, command)`: проверка меты и manifest своей платформы, запись в хранилище платформы, импорт меты платформы, активный билд и очистка только своей платформы; `409` при `buildId` другой платформы
- [x] 2.2 `GetActivePluginBuildUseCase(platform, actor)`: `404` без хранилища или активного билда платформы
- [x] 2.3 Маршруты `POST /api/ds/admin/web-preview/plugin-builds` и `GET /api/ds/web-preview/plugin`; ответ web с `platform` и `libraryVersion`; маршруты Compose без изменения формата
- [x] 2.4 OpenAPI (`documentation.yaml`) и `contracts/route-manifest.json` для `GET /api/ds/web-preview/plugin` (маршрут публикации, как у Compose, в них не входит), счётчик операций в тестах
- [x] 2.5 Unit-тесты: разбор manifest web и compose, use case публикации (платформа меты, `409` чужой платформы, очистка не трогает другую платформу), выдача активного билда по платформе
- [x] 2.6 HTTP-тест на Postgres и MinIO по образцу теста публикации Compose: публикация web (пробная и настоящая), импорт меты web, выдача адреса web, Compose-билд не меняется; отсутствие MinIO в тесте MUST ронять тест, а не пропускать его

## 3. Gateway и локальная инфраструктура

- [x] 3.1 `location = /api/admin/web-preview/plugin-builds` в `nginx.local.conf` и `nginx.prod.conf.template` с правилами публикации Compose; скрипт проверки маршрутов gateway
- [x] 3.2 `docker-compose.local.yml`: бакет `web-preview` с анонимным чтением в `minio-init`, переменные хранилища web у ds-service; `docker-compose.prod.yml`: переменные хранилища web

## 4. CLI (frontend-kt)

- [x] 4.1 `PublishPreviewPluginUseCase`: платформы `compose` и `react`, проверка manifest своей платформы, нормализатор меты по платформе (`WebApiMetaNormalizer` для `react`)
- [x] 4.2 `HttpPreviewPluginRemoteSource`: маршрут и платформа меты по платформе, имя части архива
- [x] 4.3 `preview-plugin publish`: справка по `--platform compose|react`
- [x] 4.4 Тесты use case и источника: web-архив уходит в маршрут web с метой `web`, архив Compose с `--platform react` отклоняется до запроса

## 5. Web-плагин: упаковка

- [x] 5.1 Скрипт `npm run package` в `js/apps/preview-web-plugin`: проверка чистоты каталога, сборка, `commit`/`version`/`apiMetaSha256` в `dist/preview-plugin.json`, zip в `local-dev/web-preview/preview-web-plugin.zip`, блок происхождения в `local-dev/README.md`
- [x] 5.2 Тест упаковки: manifest архива проходит правила ds-service для `web`, `apiMetaSha256` совпадает
- [x] 5.3 Собрать и закоммитить `local-dev/web-preview/preview-web-plugin.zip`

## 6. Клиент

- [x] 6.1 `fetchWebPreviewPluginDescriptor` и `resolveWebPreviewPluginUrl`: прямой адрес, иначе бэкенд, кеш на проект без кеширования ошибок
- [x] 6.2 `useWebPreviewPlugin`, прогрев в разделе компонентов и канвас «Цвета» на асинхронном адресе; «Превью недоступно» с причиной при `404` и ошибке
- [x] 6.3 `js/docker-compose.dev.yml`: `VITE_WEB_PREVIEW_PLUGIN_URL` по умолчанию пустая, сервис `preview-web-plugin` удалён (плагин для разработки запускается из своего каталога)
- [x] 6.4 README клиента: источник адреса web-плагина, режим разработки плагина
- [x] 6.5 Тесты: адрес от бэкенда, прямой адрес без запроса, один запрос на проект, `404` отключает только web-превью

## 7. Локальный контур

- [x] 7.1 `publish-preview-plugin.sh --platform compose|react`; `publish-compose-plugin.sh` — обёртка над ним
- [x] 7.2 `setup-local.sh`: публикация web после Compose, `--web-plugin-zip` / `WEB_PREVIEW_PLUGIN_ZIP`, `--skip-plugin` для обоих, предупреждение при ошибке архива по умолчанию
- [x] 7.3 `setup-local.ps1`: то же (`-WebPluginZip`, `-SkipPlugin`)
- [x] 7.4 `local-dev/README.md`: таблица архивов, происхождение web-архива, когда и как его обновлять, бакет `web-preview` в разделе про MinIO
- [x] 7.5 `start-local.sh` и `setup-local.ps1` перезапускают gateway после `up`: файл `nginx.local.conf` примонтирован отдельно, и после обновления репозитория контейнер видит старый конфиг (публикация web отвечала `404`)

## 8. Локальные проверки

- [x] 8.1 `JAVA_TOOL_OPTIONS=-Dapi.version=1.44 TESTCONTAINERS_RYUK_DISABLED=true ./gradlew :ds-service:buildAll :architecture-tests:test` в `backend-kt`
- [x] 8.2 `./gradlew build` в `frontend-kt`
- [x] 8.3 `npm test`, `npx tsc -p tsconfig.app.json --noEmit`, `npm run build` в `js/apps/client`; `npm test`, `npx tsc -b` в `js/apps/preview-web-plugin`
- [x] 8.4 `openspec validate publish-web-preview-plugin --strict`
- [x] 8.5 `./setup-local.sh` на чистом контуре: web-плагин в бакете `web-preview`, превью web-компонентов в редакторе загружается из MinIO, Compose-превью работает

## 9. Проверки до архивирования

- [ ] 9.1 [внешняя проверка] Публикация web-плагина на DEV командой CLI под служебной учёткой: ответ `published`, `GET /api/projects/{id}/ds/web-preview/plugin` отдаёт адрес, превью web-компонентов на DEV загружается из S3
