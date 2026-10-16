## 1. Клиент

- [x] 1.1 Удалить действие «Опубликовать документацию» из `js/apps/client/src/pages/Debug.tsx` и `generateAndDeployDocumentation` из `pages/Main.utils.ts`; убрать её мок и проверку из `pages/Main.test.tsx`

## 2. Удаление сервиса в js

- [x] 2.1 Удалить `js/services/documentation-generator` целиком
- [x] 2.2 Удалить скрипты `dev:documentation-generator`, `build:documentation-generator` и их упоминания в `dev:services`/`build:services` из `js/package.json`
- [x] 2.3 Удалить сервис `docs-generator` и том `docs_output` из `js/docker-compose.dev.yml`, упоминания из `js/setup-docker.sh`

## 3. Шлюз, деплой и CI

- [x] 3.1 Удалить upstream `docs_service_api` и маршрут `/api/projects/{projectId}/docs` из `backend-kt/identity-gateway/gateway/nginx.local.conf` и `nginx.prod.conf.template`
- [x] 3.2 В `test-route-namespaces.sh` заменить проверки блока `/docs` проверкой с явным выходом (не `! grep`, который под `set -e` не останавливает скрипт), что блока и `docs_service_api` нет; проверки `/documentation` оставить
- [x] 3.3 Удалить сервис `docs-generator`, том `docs_output`, его `depends_on` у `gateway`, переменные `DOCS_SERVICE_UPSTREAM_*` (включая `envsubst`) и опустевший раздел `volumes` из `docker-compose.prod.yml`; добавить `gateway` прямую зависимость от `db-service`, которую раньше давал `docs-generator`
- [x] 3.4 Удалить образ `documentation-generator` из `.github/workflows/publish-backend-images.yml`; путь сервиса в ESLint, job тестов и сборку из `.github/workflows/validate-js.yml`

## 4. Документация и OpenSpec

- [x] 4.1 Обновить `js/README.md`, `js/CLAUDE.md`, `README.md`, `backend-kt/DEPLOY.md`: без docs-generator, восемь сервисов
- [x] 4.2 Обновить `openspec/config.yaml`
- [x] 4.3 Поиском убедиться, что вне архива OpenSpec не осталось ссылок на `documentation-generator`, `docs-generator`, `docs_service_api`, `DOCS_SERVICE_UPSTREAM`, `docs_output`, `generateAndDeployDocumentation`, `/docs/api/documentation`

## 5. Проверки

- [x] 5.1 `cd js && npm run build`, `npx vitest run` в `apps/client`, `npm run test:cli`
- [x] 5.2 `sh backend-kt/identity-gateway/gateway/test-route-namespaces.sh` и `nginx -t` нового `nginx.local.conf` в контейнере gateway
- [x] 5.3 `docker compose -f docker-compose.prod.yml config` с тестовыми значениями обязательных переменных: восемь сервисов, без `docs-generator`
- [x] 5.4 `openspec validate remove-documentation-generator-service --type change --strict --no-interactive`

## 6. Архивация

- [x] 6.1 После архивации обновить Purpose спеки `web-design-system-publication`: документация в клиенте больше не строится
