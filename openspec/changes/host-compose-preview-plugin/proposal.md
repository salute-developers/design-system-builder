## Why

Compose-preview в редакторе компонентов работает с плагином по одному адресу, вшитому в сборку клиента (`VITE_COMPOSE_PREVIEW_PLUGIN_URL`). Плагин собирается в `plasma-android` и порождает фабрики стилей по API-мете `uikit-compose`, а набор компонентов и свойств в редакторе задаёт мета, импортированная в БД командой `dsbuilder components import-api`. Если плагин и мета собраны из разных версий, расхождения тихие: свойство есть в редакторе, но плагин его не знает.

Публиковать плагин в S3 из `plasma-android` неправильно: у чужого репозитория не должно быть ключей хранилища DSB, а версии, согласованность плагина с метой и очистку должен вести бэкенд. Поэтому CI `plasma-android` отправляет собранный архив на бэкенд командой `dsbuilder`, а бэкенд за одну операцию кладёт файлы в S3, импортирует мету из архива и записывает билд в свою БД. Клиент узнаёт у бэкенда адрес актуального плагина.

## What Changes

- **Бэкенд (`backend-kt/ds-service`)**: реестр билдов плагина. Таблица `compose_preview_plugin_builds` (Flyway `V12`), маршрут публикации `POST /api/admin/compose-preview/plugin-builds` (архив и нормализованная мета одним запросом), проверка архива и manifest, заливка файлов в S3, импорт меты и запись активного билда в одной транзакции БД, идемпотентность, пробная отправка, очистка старых билдов.
- **Выдача адреса клиенту**: маршрут `GET /api/projects/{projectId}/ds/compose-preview/plugin` возвращает адрес и версию активного билда.
- **Хранилище**: порт `PluginBuildStorage` с реализацией на AWS SDK v2 (как в `documentation-service`), настройка через переменные окружения; публичное чтение префикса плагина в бакете.
- **Авторизация CI**: служебная учётка Keycloak (`client_credentials`) с ролью `compose_preview_publisher`; gateway передаёт роль доверенным заголовком; публиковать могут эта роль и системный администратор; другие маршруты роль не открывает.
- **CLI (`frontend-kt`)**: команда `dsbuilder preview-plugin publish --platform compose --from <zip>` (по умолчанию пробная отправка, `--apply` для записи), неинтерактивный вход служебной учёткой из переменных окружения, нормализация меты из архива, вывод итога и отчёта импорта.
- **Поставка CLI**: JVM-дистрибутив CLI (архив со стартовыми скриптами) и workflow публикации релиза CLI, чтобы CI `plasma-android` мог скачать закреплённую версию.
- **Клиент (`js/apps/client`)**: адрес плагина берётся из бэкенда; `VITE_COMPOSE_PREVIEW_PLUGIN_URL` остаётся прямым переопределением для локальной разработки.
- **Локальный контур**: MinIO контура получает бакет и публичное чтение для плагина, Keycloak контура — служебную учётку для проверки.

Не входит: сборка и отправка из CI (change `publish-compose-preview-plugin` в `plasma-android`); версия меты на дизайн-систему (мета и активный билд одни на окружение); откат на произвольный билд отдельной командой (откат делается повторной публикацией старого билда); разделение origin плагина и клиента (плагин в бакете клиента, общий origin принят как риск, пока плагин публикует только команда SDDS); подпись плагина.

## Capabilities

### New Capabilities
- `compose-preview-plugin-registry`: реестр билдов плагина на бэкенде: публикация (архив и мета одной операцией), проверки, хранение в S3 и БД, идемпотентность, активный билд, выдача адреса, очистка.
- `preview-plugin-publisher-auth`: служебная учётка и роль публикации: Keycloak, gateway, права на маршруты.
- `cli-preview-plugin`: команда `dsbuilder preview-plugin publish`.
- `compose-preview-plugin-selection`: получение клиентом адреса активного билда от бэкенда и отказоустойчивость.

### Modified Capabilities
- `compose-preview-plugin-loading`: источник адреса плагина — бэкенд, прямой адрес остаётся переопределением.
- `compose-preview-rollout`: условие включения Compose-preview.

## Impact

- `backend-kt/ds-service`: `feature-components` (маршруты публикации и чтения, use case, репозиторий, порт хранилища, распаковка архива), `app` (Flyway `V12`, конфигурация S3, DI), `contracts` (манифест маршрутов, аудит потребителей), `src/main/resources/openapi/documentation.yaml`, каталог версий (AWS SDK `software.amazon.awssdk:s3`).
- `backend-kt/identity-gateway`: `feature-auth` (роль `compose_preview_publisher`, доверенный заголовок `X-Compose-Preview-Publisher`), `gateway` (маршрут публикации с лимитом тела), `keycloak` (клиент, роль, аудитория; realm локального и production контура, bootstrap-скрипт).
- `backend-kt/docker-compose.local.yml` и production-конфигурация: переменные S3 для `ds-service`, бакет и политика чтения MinIO.
- `frontend-kt`: `feature-components` или новая feature `preview-plugin` (use case, порты, HTTP-источник, чтение архива, хеширование), `cli` (команда, вход служебной учёткой), `USAGE.md`.
- `.github/workflows` и `frontend-kt/cli`: задача сборки JVM-дистрибутива CLI и workflow публикации релиза CLI.
- `js/apps/client`: `src/composePreview` (получение адреса, кеш, условие включения), `src/api/themeEditorRepository.ts`, `README.md`.
- Публичные API: два новых маршрута; контракт `import-api-meta` не меняется. `js/services/db-service` не затрагивается: таблица принадлежит `ds-service` (как `token_groups`).
- Конфигурация и секреты: переменные S3 и публичный адрес плагина у `ds-service`; секрет служебной учётки живёт в секретах `plasma-android`.
- Проверка: `cd backend-kt && ./gradlew build`, `cd backend-kt/identity-gateway && ./gradlew build`, `cd frontend-kt && ./gradlew build`, `cd js/apps/client && npm run build && npm test`, локальный контур `./setup-local.sh` со сквозной публикацией.
