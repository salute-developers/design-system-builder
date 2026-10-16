## Why

`js/services/documentation-generator` (NestJS, порт 3006) собирает Docusaurus-сайт по установленному
из npm пакету дизайн-системы и выгружает его в S3. Пакеты больше не публикуются в npm, генерацию
вызывает только отладочная кнопка «Опубликовать документацию» на странице Debug, а документация
продукта развивается в Kotlin `documentation-service` и `dsbuilder docs`. Сервис устарел, но его всё
ещё собирают, деплоят, держат за шлюзом и снабжают S3-ключами. Удаляем его и всё, что с ним связано.

## What Changes

- **BREAKING** Удаляется сервис `js/services/documentation-generator`: код, Dockerfile, образ
  `documentation-generator`, сервис `docs-generator` в dev и prod compose, том `docs_output`,
  npm-скрипты, сборка, линт и тесты в CI, переменные окружения.
- **BREAKING** Шлюз больше не проксирует `/api/projects/{projectId}/docs/*`: удаляются upstream
  `docs_service_api` и маршрут в `nginx.local.conf` и `nginx.prod.conf.template`, переменные
  `DOCS_SERVICE_UPSTREAM_*` и их место в `envsubst`; проверка маршрутов шлюза перестаёт требовать
  этот блок.
- Веб-клиент теряет действие «Опубликовать документацию» на странице Debug и функцию
  `generateAndDeployDocumentation`.
- Production compose запускает восемь сервисов вместо девяти.
- Kotlin `documentation-service`, маршрут `/api/projects/{projectId}/documentation` и `dsbuilder docs`
  не меняются. `NPM_PACKAGE_SCOPE` остаётся: его использует `js/cli`.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `container-image-delivery`: набор production-образов и compose сокращается до восьми, без
  `documentation-generator`.
- `documentation-bundle-ingestion`: сценарий о независимом маршруте `/docs` заменяется сценарием,
  что шлюз не проксирует `/docs` в удалённый сервис, а маршрут `/documentation` работает как прежде.
- `web-design-system-publication`: добавляется требование, что веб-клиент не запускает генерацию
  документации и не обращается к `/api/projects/{projectId}/docs/*`.

## Impact

- **js**: удаляется `services/documentation-generator`; `apps/client` — `pages/Debug.tsx`,
  `pages/Main.utils.ts`, `pages/Main.test.tsx`; `package.json` (скрипты `dev:*`/`build:*`),
  `docker-compose.dev.yml`, `setup-docker.sh`, `README.md`, `CLAUDE.md`.
- **backend-kt**: `identity-gateway/gateway/nginx.local.conf`, `nginx.prod.conf.template`,
  `test-route-namespaces.sh`; `DEPLOY.md`. Kotlin-код не меняется.
- **frontend-kt**: изменений нет.
- **Корень репозитория**: `docker-compose.prod.yml`, `.github/workflows/publish-backend-images.yml`,
  `.github/workflows/validate-js.yml`, `README.md`.
- **Примеры окружения**: из `.env.prod.example` и `js/.env.example` удаляются `AWS_*` сервиса.
  `tools/verify` запрещает `.env.*` в diff, поэтому эта правка идёт отдельным коммитом вне Change.
- **openspec**: `config.yaml`, дельты спецификаций.
- **Эксплуатация**: на стендах Coolify удаляются сервис `docs-generator`, том `docs_output` и
  переменные `AWS_*` этого сервиса; уже выгруженные в S3 сайты остаются.
