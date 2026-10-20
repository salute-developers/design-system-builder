## 1. Код и локальный запуск

- [x] 1.1 Удалить `js/services/db-service`, `js/setup-docker.sh`, `js/docs/db-schema.dbml`; из `js/package.json` — скрипты db-service; из `js/docker-compose.dev.yml` — `postgres-registry`, `db-service`, том и `depends_on` клиента.
- [x] 1.2 Фикстура `buttonSeed.ts` для `colorTokens/domain/domain.test.ts`; `cd js/apps/client && npx vitest run src/modules/colorTokens`.
- [x] 1.3 `setup-local.sh`: убрать остановку legacy-стека, оставить `js_compose up -d --build client`; `--reset` чистит тома обоих compose-файлов.

## 2. Gateway, compose, CI, verify

- [x] 2.1 `nginx.local.conf`, `nginx.prod.conf.template`: удалить upstream `db_service_api` и блок `/ds/legacy`; `test-route-namespaces.sh` проверяет отсутствие; `docker-compose.prod.yml` без `db-service`, `DB_SERVICE_UPSTREAM_*` и envsubst-переменных.
- [x] 2.2 `publish-backend-images.yml` без `db-service`; `validate-js.yml` без контура db-service.
- [x] 2.3 `.verification/config` без `javascript-db-service`; удалить `.verification/strictacode-baseline/javascript-db-service.json`, `backend-kt/scripts/test-ds-service-differential.sh`, `backend-kt/docker-compose.db-service-test.yml`, `backend-kt/ds-service/contracts/{consumer-route-audit,excluded-route-groups}.json`.

## 3. Скиллы, документация, спеки

- [x] 3.1 Удалить `.claude/skills/sync-all|sync-routes|sync-spec|sync-validation`; поправить `.agents/skills/pr-description/SKILL.md`, `frontend-kt/feature-components/API_META_NORMALIZERS.md`.
- [x] 3.2 Переписать `js/CLAUDE.md`, `js/README.md`, `js/docs/component-creation.md`; обновить `AGENTS.md`, корневой `README.md`, `backend-kt/DEPLOY.md`, `backend-kt/ds-service/README.md`, `backend-kt/ds-service/production-env.example`, `openspec/config.yaml`.
- [x] 3.3 Дельты спек по списку из proposal (REMOVED `component-seed-format`; MODIFIED/REMOVED в остальных).

## 4. Проверка

- [x] 4.0 Удалить `openspec/specs/component-seed-format` файлом (архив не принимает спеку без требований).

- [x] 4.1 `cd js && npm run build`; `cd js/apps/client && npm test`; `bash -n` скриптов; `backend-kt/identity-gateway/gateway/test-route-namespaces.sh`; `cd backend-kt && ./gradlew build`.
- [x] 4.2 `tools/verify fast/full --change remove-db-service`; `grep -ri db-service` по репозиторию без `openspec/changes/archive` даёт только documentation-service (`DB_SERVICE_*`), Flyway-ресурсы и `.env.prod.example`.
- [x] 4.3 [внешняя проверка] `./setup-local.sh --reset` проходит, клиент видит `base`; `./tools/e2e api-project-access`.
