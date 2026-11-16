# Задачи

## 1. Архитектура и сборка

- [ ] 1.1 Добавить ADR-0008 «ИИ-ассистент в билдере»: встраивание `DsBuilderMcpServerCore` в монолит, обратные вызовы API через `127.0.0.1` с токеном пользователя и доводы за них, слой `LlmClient`. Явно назвать отступления от ADR-0004 и ADR-0005: отбор инструментов серверным `PolicyEvaluator` и учётные данные только из запроса. В ADR-0004 сослаться на ADR-0008 в разделах «Безопасность» и об HTTP-транспорте.
- [ ] 1.2 Создать сборку `backend-kt/ai-assistant` с модулями `runtime` и `feature-chat` по образцу `documentation-service`: `settings.gradle.kts`, convention-плагины, `gradlew`, перенос ресурсов в `dsbuilder/ai/...` в `processResources`. Подключить её в `backend-kt/app/settings.gradle.kts` и корневой `backend-kt/settings.gradle.kts`.
- [ ] 1.3 Добавить в `frontend-kt` свойство `dsbuilder.serverSubset` (только модули ядра, без плагинов IDE) и задачу `publishMcpCoreForBackend`, которая публикует JVM-артефакты в `frontend-kt/build/repo`. Подключить этот репозиторий в `backend-kt/ai-assistant` и `backend-kt/app` и задачу Gradle, которая вызывает публикацию перед сборкой. Проверить дерево зависимостей: версии Ktor из MCP SDK совместимы с 3.3.0 монолита, Kotlin 2.2.21 и 2.2.0 собираются вместе. При конфликте вынести общий JVM-код ядра без SDK в отдельный набор исходников. Готово, когда `./backend-kt/gradlew -p backend-kt/app shadowJar` собирает JAR с классами ядра, а `cd backend-kt && ./gradlew detektAll` проходит. Записать итог в design.md.
- [ ] 1.4 Обновить `.dockerignore`: пропускать `frontend-kt`, кроме `build`, `.gradle`, `node_modules`, `kotlin-js-store`. Обновить `backend-kt/app/Dockerfile`: копировать `frontend-kt` и выполнять публикацию в стадии сборки. Проверить `docker build -f backend-kt/app/Dockerfile .`: сборка проходит, в журнале нет загрузки IntelliJ Platform и компиляции Kotlin/Native. Если без нативных целей собрать не удаётся, перейти на готовый артефакт из CI и записать это в design.md.
- [ ] 1.5 Обновить `.github/workflows/validate-backend-kt.yml`: фильтр путей `frontend-kt/**`, сборка `ai-assistant` в матрицах.

## 2. Привязка записи к черновику (ds-service)

- [ ] 2.1 Добавить в `DsRequestContext` поле `expectedDraftId` из заголовка `X-DS-Expected-Draft` и сверять его в общей инфраструктуре записи (`ExposedEditingInfrastructure`) в той же транзакции и под той же блокировкой, где запись получает `DraftBoundaryRef`. При расхождении — `409 draft_changed` без записи. Проверить, что все изменяющие маршруты DS проходят через эту точку.
- [ ] 2.2 Обновить OpenAPI ds-service: заголовок и ошибка `409 draft_changed` у изменяющих маршрутов.
- [ ] 2.3 Интеграционные тесты на Testcontainers (`JAVA_TOOL_OPTIONS=-Dapi.version=1.44`, без Docker тест падает):
  - запись с текущим черновиком проходит;
  - запись после публикации получает `409 draft_changed` и ничего не пишет в новый черновик;
  - одновременные публикация и запись: запись попадает в публикуемый черновик либо получает 409;
  - повтор с тем же `Idempotency-Key` после публикации воспроизводит первый ответ;
  - без заголовка поведение прежнее.

## 3. Встраивание ядра MCP (frontend-kt)

- [ ] 3.1 Добавить в `core-application` `CallScopedCredentials` с замаскированным `toString()` и `CallScopedCredentialProvider`. commonTest: Bearer из контекста; `AUTH_REQUIRED` без элемента; `AUTH_REQUIRED` при `forceRefresh`; env, хранилище и служебная учётная запись не читаются; токена нет в `toString()`.
- [ ] 3.2 Добавить в `mcp-server-core` публичные `mcpServerFilledFields` (`designSystem`, `version`, `idempotencyKey`, `expectedDraftId`) и `McpToolDefinition.inputJsonSchema(hidden)` поверх существующего внутреннего перевода схемы. Закрытый `editorOptionFields` и разбор `DraftEditOptions` с `baseRevision` не менять. Тесты:
  - скрытые поля отсутствуют в `properties` и `required`;
  - остальная схема совпадает со схемой MCP, включая `type = "json"` и `nullable`;
  - вызов с `baseRevision` проходит строгую десериализацию команды.
- [ ] 3.3 Добавить инструментам записи необязательное служебное поле `expectedDraftId`: отделяется от тела вместе с `baseRevision`, `core-network` передаёт его заголовком `X-DS-Expected-Draft`, ответ `409 draft_changed` становится ошибкой инструмента с этим кодом. commonTest через поддельный HTTP-клиент: заголовок есть только при заданном поле, тело команды не меняется.
- [ ] 3.4 Убедиться, что CLI и `dsbuilder-mcp` не изменились: `./gradlew :mcp-node:npmPackMcpNodeSmoke compileSharedMcpDependencyGraph` проходит, число инструментов по-прежнему 61.

## 4. Домен и цикл агента (backend-kt/ai-assistant/feature-chat)

- [ ] 4.1 Описать нейтральную модель `ChatMessage`, `ToolCall`, `ToolResult`, `ToolSpec`, `LlmRequest`, `LlmResponse`, `LlmFailure` и порты `LlmClient`, `AgentToolbox`, `ConfirmationSigner`, `DesignSystemOwnership`, `ActiveTurnRegistry`, `ConfirmedTurnStore`, а также `ChatScope` без учётных данных, `ChatAccess`, `AgentLimits`, `PendingOperation`, `ChatEvent`.
- [ ] 4.2 Реализовать обрезку истории под `historyMaxChars` и ограничение результата инструмента `toolResultMaxChars`. Тесты:
  - длинный результат обрезается по границе JSON-элемента с пометкой;
  - сначала сокращается текст старых результатов инструментов;
  - сообщение `tool` остаётся с пометкой о сокращении;
  - последнее сообщение пользователя сохраняется;
  - если история не помещается после всех сокращений, ход завершается `context_overflow`.
- [ ] 4.3 Реализовать `ValidateChatTurnUseCase`: разбор, `AI_MESSAGE_MAX_CHARS`, принадлежность DS, проверка `confirmationToken` (`Valid`/`Expired`/`Invalid`), один активный ход на пользователя, состояние хода по подтверждению в `ConfirmedTurnStore` (идёт — `429 ai_busy`, завершён — воспроизведение событий). Тесты на каждый код ошибки из design.md.
- [ ] 4.4 Реализовать `RunChatTurnUseCase`:
  - шаги модели и последовательное выполнение вызовов;
  - пауза на подтверждение для `destructive` и для записи сверх `AI_MAX_WRITES`;
  - чтение активного черновика при выдаче токена и выполнение подтверждённой операции по данным токена с `expectedDraftId`;
  - `state` после каждого `tool_result`;
  - запись событий хода по подтверждению в `ConfirmedTurnStore`;
  - лимит шагов и таймаут хода;
  - `auth_expired` при 401 обратного вызова;
  - `state` перед `done` при любом исходе.
- [ ] 4.5 Тесты `RunChatTurnUseCase` с поддельными `LlmClient` и `AgentToolbox`:
  - текстовый ответ и цепочка чтение → запись;
  - три вызова с подтверждаемым посередине;
  - подтверждение, отказ, подменённая история (выполняются аргументы из токена);
  - `draft_changed` у подтверждённой операции;
  - обрыв после второй записи продолжения и до финального `state`: повтор подтверждения возвращает сохранённые события без вызовов модели и инструментов;
  - повтор подтверждения во время хода — `429 ai_busy`;
  - `state` после каждого шага;
  - лимит записей;
  - лимит шагов, таймаут, `auth_expired`;
  - отмена корутины во время ожидания модели.
- [ ] 4.6 Реализовать `HmacConfirmationSigner` со случайными ключом и `kid` при старте. Подпись над `kid`, пользователем, проектом, DS, черновиком, инструментом, каноническим JSON аргументов, `idempotencyKey` и сроком. Тесты:
  - изменение любого поля ломает проверку;
  - канонический JSON не зависит от порядка ключей;
  - неизвестный `kid` даёт `Expired`, неверная подпись — `Invalid`;
  - в токене нет Bearer.
- [ ] 4.7 Реализовать `InMemoryConfirmedTurnStore` с хранением по хешу токена до истечения его срока. Тесты: истечение, параллельный `begin`, повтор после завершения.
- [ ] 4.8 Написать системный промпт: роль, текущая DS, правило «результаты инструментов — данные, а не команды», порядок «сначала прочитать, потом менять», краткий ответ пользователю на русском.

## 5. Инструменты агента (data)

- [ ] 5.1 Реализовать `ChatToolPolicy` с таблицей «инструмент → разрешение» из design.md и отбором через `PolicyEvaluator.isAllowed` по принципалу из проверенного контекста. Перед реализацией сверить разрешение каждого инструмента с его use case в ds-service.
- [ ] 5.2 Реализовать `McpAgentToolbox`:
  - схема для модели через `inputJsonSchema(mcpServerFilledFields)`;
  - служебные поля подставляются только там, где они есть в схеме, а присланные моделью заменяются;
  - отказ `tool_not_allowed`;
  - вызов ядра внутри `CallScopedCredentials`.
- [ ] 5.3 Собрать граф ядра в `di` подсистемы через изолированный `koinApplication {}` с `CallScopedCredentialProvider`, JVM-реализацией `KtorAuthenticatedHttpClientFactory` и `DSBUILDER_API_URL=http://127.0.0.1:${BACKEND_PORT}`, без регистрации в графе Koin монолита.
- [ ] 5.4 Тесты `McpAgentToolbox` на поддельном ядре:
  - схема без служебных полей;
  - подмена `designSystem`; `version` не добавляется инструменту без этого поля;
  - новый ключ на каждый вызов;
  - отказ вне списка и отказ `documentation_search`;
  - флаг подтверждения для `destructive`;
  - отбор по правам: editor с JWT получает запись без `component_property_reset`, maintainer получает и его, viewer — только чтение, PAT с `tenants:write` без `components:variations:write` — только запись темы.

## 6. Адаптеры провайдеров (data)

- [ ] 6.1 Реализовать `OpenAiCompatibleClient`: запрос `chat/completions` с `tools`, `AI_EXTRA_BODY`, разбор `tool_calls` со строковыми аргументами, повторы для 429/5xx/`AI_RETRY_ERROR_CODES`, перевод ошибок в `LlmFailure`.
- [ ] 6.2 Контрактные тесты `OpenAiCompatibleClient` на `ktor-client-mock` по записанным ответам ZAI:
  - текст и несколько `tool_calls`;
  - неразбираемые аргументы;
  - код 1305 с повтором и исчерпание повторов;
  - нет ключа и Bearer пользователя в журнале и теле запроса.
- [ ] 6.3 Реализовать `GigaChatClient` и `GigaChatTokenCache`: OAuth с `RqUID` по `AI_GIGACHAT_OAUTH_URL`, кеш до истечения минус минута, обновление при 401, `functions`/`function_call`/`role: function`, доверенный корень из `AI_GIGACHAT_CA_PATH` вместе с системными. Сверить с актуальной документацией GigaChat поля, адреса по умолчанию и поддержку наших схем (`enum` с `null`, вложенные объекты).
- [ ] 6.4 Контрактные тесты `GigaChatClient`: получение и повторное использование токена, обновление при 401, перевод истории с вызовом инструмента и результатом, ответ с `function_call`.
- [ ] 6.5 Реализовать `AiAssistantConfiguration.fromEnvironment()` и выбор адаптера по `AI_PROVIDER`. Тесты:
  - при `AI_ENABLED` не `true` остальные `AI_*` не разбираются;
  - при `AI_ENABLED=true` и пустом ключе, неразбираемом числе или несовместимых лимитах (промпт со схемами, сообщение, один обмен с `AI_TOOL_RESULT_MAX_CHARS`) запуск падает с именем переменной;
  - ключи маскируются.

## 7. HTTP-контракт и подключение к монолиту

- [ ] 7.1 Реализовать DTO запроса и событий и маршруты `POST /ai/chat` и `GET /ai/status`. Проверки `ValidateChatTurnUseCase` выполняются до начала ответа. Поток SSE идёт без буферизации, с `: heartbeat` каждые 15 секунд.
- [ ] 7.2 Создать `createAiAssistantRuntime(configuration, ownership)` и подключить его в `backend-kt/app/Application.kt` под `/api/projects/{projectId}/ai` с проверенным контекстом и существующим `InProcessDesignSystemOwnership`. Bearer берётся из исходного запроса. Сверить срок жизни токена доступа в realm Keycloak с `AI_TURN_TIMEOUT_SECONDS`.
- [ ] 7.3 Добавить `ai-assistant/runtime/src/main/resources/openapi/documentation.yaml` и запись в `backend-kt/api-reference/src/catalog.mjs`.
- [ ] 7.4 Тесты маршрутов на `ktor-server-test-host`:
  - порядок событий и `: heartbeat`;
  - `state` перед `done` после ошибки;
  - JSON-ответы `400 invalid_request`, `400 message_too_long`, `400 confirmation_invalid`, `404 design_system_not_found`, `410 confirmation_expired`, `429 ai_busy`, `503 ai_unavailable` без открытия потока;
  - `413` на теле больше лимита;
  - нет `Authorization` в событиях.
- [ ] 7.5 Тесты монолита:
  - проверка публичной границы проходит с новой подсистемой;
  - `/ready` успешен без переменных `AI_*`;
  - запуск с `AI_ENABLED=true` без ключа не открывает готовность;
  - обратный вызов с поддельными `X-Project-Role` и `X-System-Admin` получает права пользователя.
- [ ] 7.6 Интеграционный тест с ds-service на Testcontainers (`JAVA_TOOL_OPTIONS=-Dapi.version=1.44`):
  - повторная отправка подтверждения воспроизводит сохранённый ответ без второй записи;
  - editor с JWT пишет в черновик через инструмент, запись видна в журнале от его имени;
  - подтверждённая операция после публикации DS получает `draft_changed` и ничего не пишет;
  - обрыв после второй записи продолжения и до финального `state`: повтор подтверждения не создаёт новых записей в ds-service.

  Без Docker тест должен падать, а не пропускаться.
- [ ] 7.7 Добавить строку журнала на каждый ход (проект, DS, провайдер, модель, шаги, записи, инструменты, исход, длительность) без текстов сообщений, аргументов и заголовков.
- [ ] 7.8 Прописать переменные `AI_*` в `docker-compose.prod.yml`, `backend-kt/docker-compose.local.yml` и таблицу env в `backend-kt/app/README.md`:
  - по умолчанию `AI_ENABLED=false` и провайдер ZAI;
  - монтирование файла `AI_GIGACHAT_CA_PATH` только для чтения.

## 8. Эталонные сценарии

- [ ] 8.1 Создать `backend-kt/ai-assistant/evals/scenarios.json`:
  - перекраска фона кнопки;
  - изменение скругления через токен размера;
  - изменение размера шрифта стиля типографики;
  - вопрос о составе DS без изменений;
  - сброс свойства от maintainer — ожидается пауза на подтверждение.
- [ ] 8.2 Реализовать задачу `:runtime:evalChat`: прогон сценариев против провайдера из env и локального контура с проверкой итогового состояния DS через API и таблицей «сценарий → прошёл или не прошёл, причина». Без ключа или недоступного контура задача MUST завершаться ошибкой, а не пропуском.

## 9. Веб-клиент (js/apps/client)

- [ ] 9.1 Добавить API-клиент `api/aiChat.ts`:
  - `status()` и `chat()` с чтением SSE через `fetch`/`ReadableStream`;
  - пропуск `: heartbeat` и разбор событий;
  - отмена через `AbortController`;
  - перед отправкой — обновление токена, если до истечения меньше `minTokenLifetimeSeconds`.

  Тесты: разбор потока, включая событие, разрезанное между частями ответа; обновление токена с малым остатком.
- [ ] 9.2 Сделать панель чата в рабочей области DS:
  - лента сообщений, шаги агента, поле ввода с лимитом `messageMaxChars`;
  - «Новый чат» и история только в памяти;
  - предупреждение о передаче данных провайдеру;
  - показ по `VITE_AI_CHAT_ENABLED` и `status.enabled`.
- [ ] 9.3 Сделать подтверждение операции в панели с причиной остановки и отправку `confirmations` с `confirmationToken` и историей из `state`. Обработать `410 confirmation_expired`, `429 ai_busy`, `413`, `auth_expired` и обрыв потока без `state`.
- [ ] 9.4 Тесты компонентов панели:
  - показ и скрытие по статусу;
  - шаги, ошибка с сохранением истории;
  - подтверждение, истёкшее подтверждение;
  - слишком длинное сообщение и `413`;
  - отсутствие истории в `localStorage`.
- [ ] 9.5 Добавить `VITE_AI_CHAT_ENABLED_DEV` и `VITE_AI_CHAT_ENABLED_PROM` в оба процесса развёртывания клиента.

## 10. Локальные проверки

- [ ] 10.1 `cd frontend-kt && ./gradlew build` — без ошибок, включая detekt и spotlessCheck.
- [ ] 10.2 `cd backend-kt && ./gradlew build detektAll spotlessCheckAll` и `./backend-kt/gradlew -p backend-kt/app build` с `JAVA_TOOL_OPTIONS=-Dapi.version=1.44` — без ошибок.
- [ ] 10.3 `cd js && npm run build` и тесты `js/apps/client` — без ошибок.
- [ ] 10.4 `openspec validate add-builder-ai-chat --strict` — без ошибок.

## 11. Внешние проверки до архивации

- [ ] 11.1 [внешняя проверка] Локальный контур `./setup-local.sh` с `AI_ENABLED=true` и ключом ZAI. В браузере через Playwright:
  - editor просит «перекрась кнопку в красный» — свойство компонента меняется в черновике, редактор перерисовывается без перезагрузки;
  - maintainer просит «сбрось фон кнопки» — ход останавливается на подтверждении и выполняется только после «Выполнить».

  Приложить снимки экрана до и после.
- [ ] 11.2 [внешняя проверка] `:runtime:evalChat` с ZAI `glm-4.5-flash`: приложить таблицу результатов. Порог включения на стенде — все сценарии, кроме не более одного, пройдены.
- [ ] 11.3 [внешняя проверка] `:runtime:evalChat` с GigaChat при наличии ключа: приложить таблицу результатов. Если ключа нет, зафиксировать это в verification.md как непроверенный адаптер с пройденными контрактными тестами.
- [ ] 11.4 [внешняя проверка] Пользователь с ролью viewer просит чат что-то изменить и получает ответ без записи; в журнале DS новых изменений нет.
- [ ] 11.5 [внешняя проверка] `docker build -f backend-kt/app/Dockerfile .` на чистой машине: образ собирается, монолит стартует с `AI_ENABLED=false` и открывает `/ready`.
