## 1. Удаление приложения

- [x] 1.1 Убедиться поиском по репозиторию, что `js/apps/admin/src/utils/*` и `src/api/*` никем вне `apps/admin` не используются, и удалить каталог `js/apps/admin` целиком.
- [x] 1.2 Удалить `js/services/db-service/src/openapi/generate.ts` и скрипт `openapi:gen` из `js/services/db-service/package.json`.
- [x] 1.3 В `js/services/db-service/src/test/differential-runner.ts` заменить чтение `js/apps/admin/src/api/openapi.json` на импорт `spec` из `../openapi/spec`.

## 2. db-service: административные маршруты

- [x] 2.1 Удалить `src/routes/misc/tables.ts`, `src/routes/misc/queries.ts`, `src/routes/misc/schema.ts` и `src/queries/catalog.ts`; убрать их импорты и `router.use("/admin/...")` из `src/routes/index.ts`.
- [x] 2.2 Удалить из `src/openapi/spec.ts` раздел Admin (схемы, операции с тегом `Admin`, `ADMIN_PREFIX`) и переименовать `info.title` в `DB Service API`.
- [x] 2.3 Убедиться, что `src/routes/route-manifest.test.ts` и `npm test` db-service проходят без `misc/*`.

## 3. Gateway и контракты ds-service

- [x] 3.1 Удалить блок `location ~ ^/api/admin(/.*)?$` из `backend-kt/identity-gateway/gateway/nginx.local.conf` и `nginx.prod.conf.template`, оставив `location = /api/admin/component-config/import-api-meta` без изменений.
- [x] 3.2 В `test-route-namespaces.sh` убрать проверки `admin_block`, добавить проверку отсутствия regex-блока `/api/admin` и сохранить все проверки `import_meta_block`.
- [x] 3.3 Удалить группу `admin` из `backend-kt/ds-service/contracts/excluded-route-groups.json`; убрать `/api/admin/**` из `compatibilityFallbacks` и упоминание административных маршрутов из `decision` в `consumer-route-audit.json`.
- [x] 3.4 Обновить `backend-kt/identity-gateway/README.md`, если он описывает `/api/admin/**` к db-service.

## 4. Сборка, запуск и CI

- [x] 4.1 Убрать `dev:admin` и `build:admin` из `js/package.json` (скрипты `dev`, `build` и их объявления).
- [x] 4.2 Удалить сервис `admin` из `js/docker-compose.dev.yml` и шаги проверки и запуска админки из `js/setup-docker.sh`.
- [x] 4.3 Удалить шаги `Npm install admin`, `Build admin`, копирование `dist` и `s3 Upload admin build` из `.github/workflows/deploy-front-apps-dev.yml` и `deploy-front-apps-prom.yml`.
- [x] 4.4 Убрать маску `apps/admin/src/**/*.{ts,tsx}` из ESLint-шага и элемент `admin` из matrix в `.github/workflows/validate-js.yml`.

## 5. Скиллы и документация

- [x] 5.1 Удалить `.claude/skills/sync-api-types`; в `.claude/skills/sync-all/SKILL.md` оставить три шага; в `sync-routes` и `sync-spec` убрать упоминания `routes/misc/*` и админки.
- [x] 5.2 Обновить `js/CLAUDE.md` и `js/README.md`: убрать админку из таблиц сервисов, схемы, портов, скриптов, разделов «Admin: API types», «Admin: pages», описания маршрутов `/api/admin/*` и deploy workflow.
- [x] 5.3 Обновить `README.md` и `backend-kt/DEPLOY.md`: статику в S3 публикует только клиент.
- [x] 5.4 В `js/docs/component-creation.md` заменить шаг с админской панелью на привязку через `dsbuilder components push` (на стендах — `db:seed:prod`), убрать ссылку на админку и учётные данные.
- [x] 5.5 Обновить описание `js/apps/*` в `openspec/config.yaml`.

## 6. Проверка

- [x] 6.1 `cd js && npm run build` и `cd js/services/db-service && npm test`.
- [x] 6.2 `cd js && npm exec -- eslint "apps/client/src/**/*.{ts,tsx}" "services/db-service/src/**/*.ts"`.
- [x] 6.3 `sh backend-kt/identity-gateway/gateway/test-route-namespaces.sh` проходит.
- [x] 6.4 `cd backend-kt && ./gradlew build` проходит.
- [x] 6.5 `grep -rn "apps/admin\|routes/misc\|/admin/tables\|/admin/queries\|/admin/schema" --exclude-dir=node_modules --exclude-dir=openspec .` не находит ничего, кроме намеренной записи в разделе «Removed services» в `js/CLAUDE.md`.
- [ ] 6.6 [внешняя проверка] `backend-kt/scripts/test-ds-service-differential.sh` проходит с `differential-runner.ts`, читающим `spec` напрямую.
  Результат 2026-10-19: раннер стартует с импортом `spec` и доходит до сравнения ответов; падает на `GET /design-systems` из-за разных fallback-цветов `themePreviews` без профиля (db-service хэширует id темы, ds-service отдаёт константу). То же падение воспроизведено на `origin/dev` без этого change; db-service планируется удалить, поэтому расхождение не чинится.
- [ ] 6.7 [внешняя проверка] на локальном gateway `curl -X POST /api/admin/component-config/import-api-meta` с токеном пользователя доходит до ds-service, а `GET /api/admin/tables` не проксируется в db-service.
