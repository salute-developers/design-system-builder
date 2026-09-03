## 1. Application contracts и orchestration

- [x] 1.1 Обновить `DocsPublishCommand`, accepted/failure models и application port: добавить `bundleId`, runtime overrides и явные безопасные результаты без exception-driven control flow.
- [x] 1.2 Доработать `DocsPublishUseCase` для чтения configured `ProjectContext`, resolution API key/API URL и формирования project-scoped upload request.
- [x] 1.3 Добавить unit tests use case для успешного orchestration, отсутствующего config, отсутствующего API key, приоритета overrides и propagation publisher failure.

## 2. Authenticated HTTP infrastructure

- [x] 2.1 Добавить минимальный domain-neutral authenticated multipart POST contract, сохраняющий существующее GET behavior и скрывающий Ktor types от feature application слоя.
- [x] 2.2 Реализовать Ktor multipart request с `Authorization: ProjectKey`, status и response body, совместимый с CIO и Darwin engines.
- [x] 2.3 Добавить regression tests authenticated HTTP adapter для URL normalization, authorization header, multipart request и неизменившегося GET behavior.

## 3. Documentation publisher data adapter

- [x] 3.1 Заменить `HttpDocsPublisher` заглушку реальным adapter, проверяющим существование/non-directory bundle и читающим его через `CliFileSystem.readBytes()`.
- [x] 3.2 Формировать `POST /api/projects/{projectId}/documentation/bundles` с единственной file part `bundle`, исходным filename и `Content-Type: application/gzip`.
- [x] 3.3 Добавить explicit serialization DTO и mapping для accepted response `{bundleId, jobId, status}` и structured error response `{errors: [{code, message, path?}]}`.
- [x] 3.4 Реализовать безопасные fallbacks для malformed success/error bodies, HTTP auth failures, timeout и network exceptions без raw body, credentials или stack trace.
- [x] 3.5 Добавить MockEngine/data adapter tests для `202`, `400`, `401`, `403`, `413`, `415`, `422`, `503`, malformed body, transport failure, отсутствующего файла и directory path.

## 4. CLI surface и DI

- [x] 4.1 Обновить `DocsPublishCliCommand`: default `.sdds/temp/docs-bundle.tar.gz`, options `--bundle`, `--api-key`, `--api-url` и удаление `--api-base-url`.
- [x] 4.2 Выводить `bundleId`, `jobId`, `status` при успехе и deterministic failure с exit code `1` при отказе.
- [x] 4.3 Подключить filesystem, authenticated HTTP dependency, JSON codec и реальный publisher в `DocsFeatureModule` без platform-specific feature wiring.
- [x] 4.4 Добавить command parsing/output/exit-code tests для default path, overrides, accepted response и failure result.

## 5. Документация и verification

- [x] 5.1 Обновить `dsbuilder-frontend/cli/USAGE.md` для реального `docs publish`, gateway URL resolution, credential sources, нового default bundle и замены `--api-base-url` на `--api-url`.
- [x] 5.2 Исправить устаревшие KDoc и термины `zip`/`.gz` в затронутом docs publish contract на `tar.gz`.
- [x] 5.3 Выполнить `cd dsbuilder-frontend && ./gradlew :cli:test`, исправив failures только в scope change.
- [x] 5.4 Выполнить `cd dsbuilder-frontend && ./gradlew :cli:spotlessCheck :cli:detekt :cli:build` и проверить JVM, macOS arm64 и macOS x64 compilation; при formatting failure выполнить `:cli:spotlessApply`, проверить diff и повторить проверки.
- [x] 5.5 При доступном local stack и test credential выполнить smoke upload реального малого `docs-bundle.tar.gz` через gateway и подтвердить `202 Accepted`; отсутствие окружения не должно блокировать автоматические проверки.
