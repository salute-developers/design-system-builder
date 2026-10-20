## Context

После четырёх предыдущих изменений (`remove-admin-app`, `replace-legacy-component-configs-in-client`, `move-plasma-import-to-cli`, `local-contour-without-db-service`) к db-service не обращается ни один сервис и ни один клиент: `grep` по репозиторию находит только compose/CI-описания, маршрут `/ds/legacy` в Gateway, тест клиента, импортирующий сиды кнопки как фикстуру, скрипт дифференциального теста ds-service против db-service, скиллы `sync-*` и документацию. ds-service держит схему через Flyway, `V1__db_service_baseline.sql` и fingerprint адаптации лежат в его ресурсах и от JS-кода не зависят; `ArchitectureContractTest` уже запрещает ds-service ссылаться на `js/services/db-service`.

## Goals / Non-Goals

**Goals:**
- В репозитории не остаётся кода, конфигурации и CI-шагов db-service.
- Документация и спеки описывают ds-service как единственный владелец данных.
- Все проверки (`cd js && npm run build`, `backend-kt`, `frontend-kt`, `tools/verify fast/full`, e2e `setup-local.sh --reset`) проходят.

**Non-Goals:**
- Переименование переменных и диагностик documentation-service с префиксом `DB_SERVICE_`.
- Правка `.env.prod.example` (защищённый путь verify).
- Изменение Flyway-истории или ресурсов ds-service.
- Активный change `add-color-token-groups`.

## Decisions

- **Фикстура теста клиента**: `domain.test.ts` использует значения и свойства кнопки из сидов только как пример данных `view`. Нужные записи копируются в `js/apps/client/src/modules/colorTokens/domain/__fixtures__/buttonSeed.ts` (свойства с web-параметром и значения по стилям `view`), тест переключается на них; смысл проверки не меняется.
- **Gateway**: блок `/ds/legacy` и upstream удаляются без замены — маршруты `/legacy/**` в ds-service не реализованы намеренно (`design-system-model-api`), клиент и CLI к ним не обращаются (спеки `tenant-aware-theme-editor`, `cli-components`). `test-route-namespaces.sh` вместо проверки наличия блока проверяет, что `db_service_api` и `ds/legacy` в конфигах нет.
- **docker-compose.prod.yml**: сервис `db-service` и его зависимости удаляются; `documentation-service` продолжает получать `DS_SERVICE_BASE_URL` и свои таймауты с историческим префиксом.
- **verify**: контур `javascript-db-service` удаляется из `.verification/config` (strictacode `audit-set`/`compare-set`, защищённый путь `.strictacode.yml`), baseline `javascript-db-service.json` удаляется; FAST/FULL команды для `js` остаются для `apps/client` и `cli`.
- **Спеки**: `component-seed-format` оформляется как REMOVED целиком. Для спек модели данных (`component-appearance-model`, `component-state-model`) и остальных, где db-service только субъект, в дельту попадают MODIFIED-требования с заменой субъекта на ds-service; требования о сосуществовании/откате оформляются REMOVED.
- **`tools/verify`**: проверка запрещённых файлов (`.env*`, `node_modules`, …) пропускает удалённые файлы — удаление `js/services/db-service/.env.example` вместе с сервисом иначе валит FAST, хотя утечь из удалённого файла нечему. Правка защищённого пути `agent-process` входит в этот change.
- **Активный change `add-color-token-groups`**: его дельта `color-token-operations-api` повторяла сценарий «Тесты манифеста db-service», а задача 6.2 ссылалась на `consumer-route-audit.json`; сценарий из дельты убран и ссылка поправлена здесь же, чтобы порядок архивации не вернул db-service в спеку.
- **Спека `component-seed-format`** удаляется файлом вместе с change: `openspec archive` не принимает спеку без требований, поэтому дельты REMOVED для неё нет.
- **Скиллы `sync-*`** удаляются: они регенерировали валидаторы, роуты и OpenAPI db-service по `schema.ts`.
- **Документация**: `js/CLAUDE.md` описывает только клиент и `js/cli`; `js/README.md` — состав `js/`, запуск клиента через `./setup-local.sh`; `js/docs/component-creation.md` сокращается до актуального пути (`import:plasma` → `components push`, стори клиента), разделы про сиды и прод-сид удаляются; `AGENTS.md`: источник истины модели компонентов — ds-service.

## Ручные действия после слияния

- Coolify (prod и dev): удалить ресурсы `db-service`; у `documentation-service`/Gateway убрать переменные `DB_SERVICE_UPSTREAM_*`, `DATABASE_URL`.
- Разработчики с прежним JS-стеком: `./setup-local.sh` гасит его `docker compose down --remove-orphans` (контейнеры `db-service-dev`, `db-service-postgres-dev` больше не описаны в compose), `--reset` удаляет и их тома.
- GitHub: удалить пакет GHCR `db-service`; удалить секреты/переменные, которые использовались только db-service (`DATABASE_URL`); проверить, что `publish-backend-images` после слияния собирает четыре образа.
- `.env.prod.example`: убрать блок `JS db-service (Drizzle)` отдельным коммитом с `--allow-protected`.
- Отложено: переименовать в documentation-service `DB_SERVICE_CONNECT_TIMEOUT_MS`, `DB_SERVICE_REQUEST_TIMEOUT_MS` и код `DB_SERVICE_UNAVAILABLE` в `DS_SERVICE_*` (таймауты и код ошибки нужны, адресат — ds-service); при переименовании перенести значения переменных в Coolify.

## Risks / Trade-offs

- [Снаружи кто-то ещё зовёт `/api/projects/{id}/ds/legacy/**`] → после удаления Gateway отвечает 404; в репозитории таких вызовов нет, e2e и verify это подтверждают.
- [Данные прод-стенда создавались сидером db-service] → схема принадлежит Flyway, данные остаются; новые компоненты заводятся через `import:plasma` + `components push`.
- [Спеки модели данных большие, замена субъекта механическая] → дельты генерируются из текущих файлов заменой `db-service` → `ds-service` в тексте требований, вручную проверяются только сценарии, где упоминание содержательное.
