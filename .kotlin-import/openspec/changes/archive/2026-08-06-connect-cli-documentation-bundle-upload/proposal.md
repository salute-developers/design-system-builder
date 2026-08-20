## Why

Команда `dsbuilder docs publish` сейчас всегда возвращает фиктивный успешный результат и не загружает созданный `tar.gz` bundle. После появления project-scoped endpoint в `documentation-service` CLI необходимо подключить к реальному gateway contract, чтобы документационные артефакты можно было отправлять локально и из CI/CD.

## What Changes

- Реализовать реальную multipart-загрузку документационного `tar.gz` bundle через Ktor client.
- Направлять запрос через публичный gateway endpoint `POST /api/projects/{projectId}/documentation/bundles` с project API key, а не напрямую во внутренний endpoint сервиса.
- Использовать общий CLI runtime context: `projectId` и credential reference из `.sdds/config.json`, API key из runtime sources, API URL из `--api-url`, `DSBUILDER_API_URL` или default.
- Читать bundle целиком в память перед отправкой: ожидаемый размер составляет 1–5 МБ и редко превышает 10 МБ; streaming upload не входит в scope change.
- Привести default path к `.sdds/temp/docs-bundle.tar.gz` и заменить устаревшую опцию `--api-base-url` на общую `--api-url`.
- Декодировать успешный ответ с `bundleId`, `jobId` и `status`, а также безопасные структурированные ошибки ingestion endpoint.
- Добавить deterministic CLI output, exit codes и тесты для успешной публикации, локальных ошибок, HTTP-отказов и transport failures.

## Capabilities

### New Capabilities

- `documentation-bundle-cli-publishing`: Project-scoped публикация сгенерированного documentation bundle из DS Builder CLI через gateway с runtime credentials и безопасной диагностикой.

### Modified Capabilities

Нет.

## Impact

- Изменяется `dsbuilder-frontend/cli`, преимущественно packages `feature.docs`, общий authenticated HTTP adapter и DI wiring.
- CLI начинает вызывать существующий gateway API `POST /api/projects/{projectId}/documentation/bundles`; контракт `identity-gateway` и `documentation-service` не изменяется.
- **BREAKING**: у `dsbuilder docs publish` опция `--api-base-url` заменяется на согласованную с остальными командами опцию `--api-url`.
- Новые backend services, persistence, Docker-конфигурация, secrets и внешние зависимости не добавляются.
