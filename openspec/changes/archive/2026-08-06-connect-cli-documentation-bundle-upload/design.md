## Context

`dsbuilder docs generate` уже создаёт gzip-сжатый TAR archive по пути `.sdds/temp/docs-bundle.tar.gz`. Соседняя команда `docs publish` имеет presentation, application port, use case и DI wiring, но `HttpDocsPublisher` является заглушкой и возвращает фиктивный `jobId` без файловой или сетевой операции.

Публичный upload contract уже реализован gateway и `documentation-service`: клиент отправляет одну multipart file part `bundle` в `POST /api/projects/{projectId}/documentation/bundles`, аутентифицируясь через `Authorization: ProjectKey <apiKey>`. Gateway заменяет trusted actor/project headers и перенаправляет запрос во внутренний `POST /documentation/bundles`. Успех имеет вид `{bundleId, jobId, status}`, а отказ — `{errors: [{code, message, path?}]}`.

CLI является Kotlin Multiplatform приложением для JVM и macOS. Общий runtime уже умеет находить `.sdds/config.json`, разрешать API key и API URL и создавать Ktor client с CIO или Darwin engine. Реальные bundles обычно занимают 1–5 МБ и редко превышают 10 МБ.

## Goals / Non-Goals

**Goals:**

- заменить фиктивную публикацию реальным authenticated multipart upload через gateway;
- использовать тот же project context, API key resolution и API URL resolution, что и другие project-scoped команды CLI;
- сохранить границы `presentation -> application <- data` и спрятать Ktor/JSON/filesystem детали в adapters;
- выдавать стабильный результат для успешного `202`, локальных ошибок, структурированных backend diagnostics и transport failures;
- поддержать JVM и macOS без platform-specific логики внутри feature.

**Non-Goals:**

- изменение gateway или `documentation-service` upload contract;
- потоковая отправка файла, retry, progress bar, cancellation UI и параллельные uploads;
- polling ingestion job после получения `accepted`;
- idempotency или deduplication повторно отправленных archives;
- глубокая локальная проверка содержимого bundle в команде `publish`;
- хранение API key в config или вывод credential в logs/output.

## Decisions

### 1. Публикация использует project-scoped gateway route

`DocsPublishUseCase` получает configured `ProjectContext` через `ProjectContextReader`, разрешает API key через `ProjectApiKeyProvider` и API URL через `ProjectApiUrlProvider`. Data adapter формирует путь:

```text
/api/projects/{projectId}/documentation/bundles
```

и добавляет `Authorization: ProjectKey <apiKey>`. CLI не обращается к internal port `documentation-service` и не формирует trusted headers самостоятельно.

Альтернатива — отправлять запрос напрямую в `/documentation/bundles` и передавать `X-Project-*`. Она отклонена: internal endpoint доверяет только gateway topology, а CLI не имеет права создавать trusted context.

### 2. Application port возвращает явный результат вместо управления через исключения

Feature сохраняет port между application и data, но контракт публикации моделирует исходы явно: accepted response с `bundleId`, `jobId`, `status` либо failure с безопасным user-facing сообщением. Use case отвечает за project context и runtime credential resolution, data adapter — за файл, multipart, HTTP и boundary DTO mapping, presentation — за stdout и exit code.

Ktor request/response types и serialization DTO остаются в `feature.docs.data`; presentation не читает файл и не обращается к HTTP client напрямую. DI создаёт реальный publisher с `CliFileSystem`, JSON codec и Ktor-backed runtime dependency.

Альтернатива — оставить `DocsHttpClient` бросающим `IllegalArgumentException`. Она отклонена: filesystem, serialization и transport failures не являются одним типом ошибки и приводят к недетерминированному завершению команды.

### 3. Authenticated HTTP infrastructure расширяется минимально для multipart POST

Общий authenticated HTTP boundary должен позволить feature выполнить POST и получить HTTP status вместе с response body, чтобы data adapter мог декодировать ingestion diagnostics. Авторизационный header формируется общей infrastructure, а knowledge о multipart part `bundle` и DTO сервиса остаётся внутри `feature.docs`.

Изменение не должно ломать существующий GET contract команд `status` и `theme fetch`. Если общий интерфейс расширяется, новый request/response contract должен быть domain-neutral и покрыт regression tests; feature-specific DTO нельзя переносить в `core`.

Альтернатива — создать второй несвязанный Ktor client внутри docs feature. Она уменьшает изменение общего интерфейса, но дублирует security-sensitive формирование `Authorization: ProjectKey` и resolution base URL. Предпочтено переиспользование authenticated infrastructure.

### 4. Bundle буферизуется в памяти

Adapter проверяет, что `bundlePath` существует и указывает на файл, затем читает его через `CliFileSystem.readBytes()` и передаёт bytes как единственную multipart part:

```text
name: bundle
filename: <basename>.tar.gz
Content-Type: application/gzip
```

Для ожидаемых 1–5 МБ стоимость `ByteArray` и HTTP buffers приемлема. Это сохраняет реализацию общей для JVM и macOS и не требует нового streaming filesystem port.

Альтернатива — platform-specific streaming source. Она отклонена для этого change из-за непропорциональной KMP-сложности. Решение следует пересмотреть, если типичный bundle приблизится к десяткам или сотням мегабайт.

### 5. CLI surface согласуется с остальными project-scoped командами

Команда принимает:

```text
dsbuilder docs publish \
  --bundle .sdds/temp/docs-bundle.tar.gz \
  --api-key <runtime-override> \
  --api-url <runtime-override>
```

`--bundle` имеет default `.sdds/temp/docs-bundle.tar.gz`. `--api-key` и `--api-url` являются optional runtime overrides; без них используются configured credential env и `DSBUILDER_API_URL`/default. Устаревшая `--api-base-url` удаляется, чтобы не поддерживать второй механизм resolution.

Успешный output содержит `bundleId`, `jobId` и `status = accepted`. Любой отказ печатает безопасное сообщение и завершает команду с exit code `1`; raw API key, internal URL и stack trace не выводятся.

### 6. Backend diagnostics декодируются с безопасным fallback

Для `202 Accepted` adapter декодирует explicit response DTO. Для non-success ответа он пытается декодировать `errors[]` и форматирует code, message и optional bundle-relative path. Если body пуст, malformed или не соответствует contract, CLI сообщает только HTTP status и не печатает raw body.

`401` и `403` сохраняют единообразные auth-oriented сообщения общего CLI. `413`, `415` и `422` используют structured ingestion diagnostics, когда они доступны. Network exception, timeout или ошибка decoding преобразуются в deterministic failure без stack trace.

Альтернатива — всегда выводить `bodyAsText()`. Она отклонена, поскольку неожиданный gateway/upstream response может содержать внутренние сведения или HTML.

## Risks / Trade-offs

- [Risk] Multipart upload временно удерживает archive и дополнительные HTTP buffers в памяти. → Решение принято исходя из фактических размеров 1–5 МБ; streaming выделяется в отдельный change при изменении профиля данных.
- [Risk] Расширение общего authenticated HTTP contract может повлиять на `status` и `theme fetch`. → Сохранить существующий GET behavior и добавить regression tests общей infrastructure.
- [Risk] Повтор команды после client timeout может создать второй bundle/job. → Не выполнять автоматический retry; сообщать неопределённый transport failure и оставить idempotency отдельному backend/CLI contract.
- [Risk] Gateway или proxy может вернуть не-JSON ошибку. → Не выводить raw body, использовать безопасный HTTP-status fallback.
- [Risk] Удаление `--api-base-url` ломает ранний placeholder CLI surface. → Явно описать замену на `--api-url` в `USAGE.md`; реального upload behavior у старой опции не было.

## Migration Plan

1. Добавить application/result contracts и unit tests для resolution context, API key и API URL.
2. Добавить authenticated multipart capability и data adapter с MockEngine tests.
3. Подключить adapter в `DocsFeatureModule`, обновить CLI options/default path и документацию.
4. Запустить CLI tests, `spotlessCheck`, `detekt` и build для JVM/macOS targets.
5. Выполнить ручной smoke upload небольшого реального bundle через local gateway, если local stack и credentials доступны.

Rollback выполняется возвратом предыдущего CLI build; backend и сохранённые bundles не требуют миграции или удаления.

## Open Questions

Нет блокирующих вопросов. Streaming upload, progress reporting, retry/idempotency и job polling намеренно оставлены будущим changes.
