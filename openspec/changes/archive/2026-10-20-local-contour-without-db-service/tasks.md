## 1. База в стеке backend-kt

- [x] 1.1 `backend-kt/docker-compose.local.yml`: сервис `ds-db` (`postgres:16-alpine`, `ds_registry`, том `ds_db_data`, порт `${DS_DB_PORT:-5433}`, healthcheck), `ds-service` зависит от него, `DS_DATABASE_URL` по умолчанию `jdbc:postgresql://ds-db:5432/ds_registry`.
- [x] 1.2 Проверить `./backend-kt/start-local.sh --detach` с `DS_FLYWAY_ADOPT_EXISTING=false` на пустом томе: `ds-service` healthy, схема создана Flyway.

## 2. Bootstrap

- [x] 2.1 `backend-kt/bootstrap-base.sh`: ожидание Gateway и `/api/projects`, токен пользователя, поиск или создание проекта (логика из `bootstrap_user_project` в `js/setup-docker.sh`).
- [x] 2.2 CLI и мета: `DSBUILDER_CLI` (сборка `:cli:installJvmDist` при отсутствии), `DSBUILDER_WEB_API_META` (генерация `generate:api-meta` в `js/cli` при отсутствии, остановка с подсказкой без зависимостей), `dsbuilder auth login` с паролем на stdin, `components import-api --platform react --apply`.
- [x] 2.3 Дизайн-система `base` и тема `base_default` через `/api/projects/{id}/ds/*` только если их нет; версия не публикуется.
- [x] 2.4 Проверка результата: экспорт `base` непустой, у `base_default` есть значения токенов; иначе выход с ошибкой про глобальный слой.

## 3. setup-local.sh и документация

- [x] 3.1 `setup-local.sh`: остановка legacy JS-стека, backend с `DS_FLYWAY_ADOPT_EXISTING=false`, bootstrap, `up -d --no-deps client`; `--reset` чистит тома обоих стеков, `--down` останавливает оба; `check_schema_owner` убрать.
- [x] 3.2 Обновить корневой `README.md` (раздел локального контура), `backend-kt/ds-service/README.md` (абзац про `setup-local.sh`), `e2e/README.md`.

## 4. Проверка

- [x] 4.1 `bash -n` скриптов; `cd backend-kt && ./gradlew build` не затрагивается (изменений Kotlin нет), `tools/verify fast/full --change local-contour-without-db-service`.
- [x] 4.2 [внешняя проверка] `./setup-local.sh --reset` на машине разработчика: контур поднимается, `base` с компонентами и темой видна в клиенте на `http://localhost:3002`, `dsbuilder ds fetch` отдаёт тему и компоненты; повторный `./setup-local.sh` без `--reset` ничего не дублирует.
