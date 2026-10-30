## Why

Web-плагин превью (`js/apps/preview-web-plugin`) клиент сейчас берёт только по адресу из `VITE_WEB_PREVIEW_PLUGIN_URL`, а локально его отдаёт отдельный контейнер на `:3011`. Бэкенд web-плагин не публикует, поэтому на стендах превью web-компонентов недоступно, а web API-мету в глобальный слой компонентов импортируют отдельной ручной командой, независимо от версии плагина.

Compose-плагин уже публикуется через ds-service: архив и мета уходят одной командой CLI, файлы лежат в S3 (локально в MinIO), бэкенд отмечает активный билд и импортирует мету, клиент спрашивает адрес у бэкенда. Web-плагин должен публиковаться и загружаться так же, чтобы его версия и мета менялись одной операцией, а локальный контур и стенды работали одинаково.

## What Changes

- **ds-service: реестр билдов для платформы `web`.** Публикация и выдача активного билда работают для `compose` и `web`:
  - новые маршруты `POST /api/ds/admin/web-preview/plugin-builds` и `GET /api/ds/web-preview/plugin`, параллельные Compose;
  - manifest web-плагина проверяется по правилам своей платформы: `platform: web`, `plasmaNewHopeVersion` вместо `uikitComposeVersion`, остальные правила общие;
  - при публикации импортируется web API-мета (платформа `web`), как Compose-мета для Compose;
  - файлы web-билдов хранятся отдельно от Compose: свой бакет или префикс `web-preview`, своя очистка старых билдов;
  - версия библиотеки билда хранится в общей колонке, а не в `uikit_compose_version`.
- **Gateway:** маршрут публикации web-плагина пропускается так же, как Compose: только токен пользователя, роль публикации или системного администратора, лимит тела 64 МБ.
- **CLI:** `dsbuilder preview-plugin publish --platform react` публикует web-плагин — проверяет архив, нормализует web-мету и отправляет её в маршрут web. `--platform compose` работает как раньше.
- **Web-плагин:** команда упаковки собирает плагин и пишет архив `preview-web-plugin.zip` с `commit`, `version` и `apiMetaSha256` в `preview-plugin.json`.
- **Клиент:** адрес web-плагина приходит от бэкенда (`GET /api/projects/{projectId}/ds/web-preview/plugin`), как у Compose. `VITE_WEB_PREVIEW_PLUGIN_URL` остаётся прямым адресом для разработки самого плагина. Без опубликованного билда превью web-компонентов недоступно с причиной.
- **Локальный контур:**
  - архив плагина хранится в `local-dev/web-preview/preview-web-plugin.zip`;
  - `setup-local.sh` и `setup-local.ps1` публикуют его в локальный MinIO рядом с `compose-preview` той же командой CLI;
  - `minio-init` создаёт бакет `web-preview`;
  - контейнер `preview-web-plugin` на `:3011` удаляется из `js/docker-compose.dev.yml`: для разработки самого плагина его запускают из каталога.

## Capabilities

### New Capabilities

- `web-preview-plugin-publication`: публикация web-плагина в ds-service — маршруты, проверки manifest для `web`, хранение билдов отдельно от Compose, импорт web-меты, выдача адреса активного билда, команда CLI и маршрут gateway.
- `web-preview-plugin-selection`: клиент получает адрес web-плагина у бэкенда, прямой адрес из окружения имеет приоритет, отсутствие билда отключает только web-превью.
- `local-web-preview-plugin`: архив web-плагина в `local-dev/web-preview`, его упаковка из исходников и публикация при настройке локального контура.

### Modified Capabilities

Нет. Требования к публикации Compose-плагина (`host-compose-preview-plugin`) и к адресу web-плагина (`add-web-preview-plugin-pilot`, `unify-web-preview-payload`) ещё не перенесены в `openspec/specs`. Их изменения описаны в новых возможностях и в design.

## Impact

- **backend-kt:**
  - `ds-service/feature-components`: `PluginManifestParser`, `PluginManifest`, `PublishPluginBuildUseCase`, `GetActivePluginBuildUseCase`, `PluginBuildRoutes`, `S3PluginBuildStorage`, `PluginBuildSettings`, DI;
  - `ds-service/app`: конфигурация хранилища web (`DS_WEB_PLUGIN_*`), регистрация маршрутов, миграция Flyway (общая колонка версии библиотеки), OpenAPI, `contracts/route-manifest.json`, тесты на Postgres;
  - `identity-gateway`: маршрут публикации web в `nginx.local.conf` и `nginx.prod.conf.template`;
  - `docker-compose.local.yml`: бакет `web-preview` в `minio-init`, переменные ds-service; `docker-compose.prod.yml` — переменные web-хранилища.
- **frontend-kt:** `feature-components` (`PublishPreviewPluginUseCase`, `HttpPreviewPluginRemoteSource`, выбор нормализатора меты по платформе), `cli` (`preview-plugin publish --platform react`).
- **js:**
  - `apps/preview-web-plugin`: скрипт упаковки архива;
  - `apps/client`: получение адреса web-плагина у бэкенда, README;
  - `docker-compose.dev.yml`: адрес web-плагина по умолчанию от бэкенда, сервис `preview-web-plugin` удалён.
- **Корень репозитория:** `setup-local.sh`, `setup-local.ps1`, `publish-compose-plugin.sh` (публикация с выбором платформы), `local-dev/web-preview/`, `local-dev/README.md`.
- Стенды: ds-service получает переменные хранилища web; ручное заведение их в Coolify — шаг выкладки. Публикация web-плагина на стенды из CI в это изменение не входит.
