## Why

Compose-preview в редакторе компонентов сегодня работает с плагином по одному адресу, вшитому в сборку клиента (`VITE_COMPOSE_PREVIEW_PLUGIN_URL`). Плагин собирается в `plasma-android` из исходников `uikit-compose` и порождает фабрики стилей по API-мете этой библиотеки, а набор компонентов и свойств, который видит редактор, задаёт мета, импортированная в БД командой `dsbuilder components import-api`. Если плагин и мета собраны из разных версий, расхождения тихие: свойство есть в редакторе, но плагин его не знает.

В `plasma-android` плагин начинает публиковаться в S3: неизменяемые билды и индекс канала с версиями `uikit-compose` (change `publish-compose-preview-plugin`). Чтобы клиент загружал актуальную и совместимую версию плагина, DSB должен знать, из какой версии `uikit-compose` импортирована мета, и выбирать по ней билд.

## What Changes

- **Бэкенд (`backend-kt/ds-service`)**: новая таблица `component_meta_versions` (Flyway `V7`) с записью на платформу: версия `uikit-compose`, sha256 файла меты, источник, кто и когда импортировал. Версия одна на платформу и на окружение.
- **Импорт меты (`import-api-meta`)**: в метаданные запроса добавляются необязательные `uikitComposeVersion` и `sha256`; при успешном импорте без `dryRun` запись версии обновляется в той же транзакции. Повторный импорт той же пары идемпотентен; та же версия с другим sha256 отклоняется целиком. В ответ добавляется итог по версии меты.
- **Чтение версии**: новый маршрут `GET /api/projects/{projectId}/ds/component-meta-versions/{platform}`, доступный по праву `components:read`.
- **CLI (`frontend-kt`)**: `dsbuilder components import-api` принимает `--uikit-compose-version` или `--plugin-manifest` (файл `preview-plugin.json` билда плагина), считает sha256 файла меты и передаёт оба значения. Для платформы `compose` при `--apply` одно из значений обязательно.
- **Клиент (`js/apps/client`)**: адрес плагина больше не единственный. Клиент читает закреплённую версию из бэкенда, читает индекс канала в S3 и выбирает билд: наибольшая версия не выше закреплённой; при отсутствии закреплённой версии или подходящей версии берётся последний билд канала. Во всех неточных случаях в области Compose-preview показывается предупреждение. Переменная `VITE_COMPOSE_PREVIEW_PLUGIN_URL` остаётся прямым переопределением для локальной работы и обходит выбор.
- **Настройка окружений**: новые переменные сборки клиента `VITE_COMPOSE_PREVIEW_PLUGIN_BASE_URL` и `VITE_COMPOSE_PREVIEW_CHANNEL`; значения задаются в workflows выкладки клиента (dev и prom) и в `docker-compose.dev.yml`.

Не входит: разделение origin плагина и клиента (плагин размещается в том же бакете, что и клиент, и общий origin принят как риск, пока плагин публикует только команда SDDS); публикация плагина в S3 (change `publish-compose-preview-plugin` в `plasma-android`); автоматический импорт меты (импорт остаётся ручной операцией системного администратора); версия меты на дизайн-систему (пока одна версия на окружение); проверка подписи плагина.

## Capabilities

### New Capabilities
- `component-meta-version`: хранение версии и sha256 импортированной меты по платформе, запись при импорте, идемпотентность и защита от тихой подмены, маршрут чтения.
- `compose-preview-plugin-selection`: выбор билда плагина клиентом по закреплённой версии и индексу канала, откат на меньшую версию, предупреждения, защита от общего origin.

### Modified Capabilities
- `component-api-meta-import`: метаданные запроса и ответ дополняются версией меты; импорт записывает версию в одной транзакции с данными.
- `cli-components`: `import-api` вычисляет sha256 файла меты и передаёт версию `uikit-compose` и sha256.
- `compose-preview-plugin-loading`: адрес плагина определяется выбором по каналу, прямой адрес остаётся переопределением.
- `compose-preview-rollout`: условие включения Compose-preview учитывает настройку выбора по каналу.

## Impact

- `backend-kt/ds-service`: `feature-components` (маршрут, use case, репозиторий, модели запроса и ответа), `app` (Flyway `V7`), `contracts` (манифест маршрутов, аудит потребителей), `src/main/resources/openapi/documentation.yaml`; затрагивается gateway только документированием маршрута (путь уже проксируется как `/api/projects/{projectId}/ds/...`).
- `frontend-kt`: `feature-components` (use case и порты импорта, HTTP-источник, чтение `preview-plugin.json`, хеширование), `cli` (опции и вывод).
- `js/apps/client`: `src/composePreview` (выбор билда, предупреждения, конфигурация), `src/api/themeEditorRepository.ts` (условие включения), `README.md`, переменные в `docker-compose.dev.yml`, `.github/workflows/deploy-front-apps-dev.yml` и `deploy-front-apps-prom.yml`.
- `js/services/db-service` не затрагивается: таблица принадлежит `ds-service` (как `token_groups` и палитры), схема в `schema.ts` не дублируется.
- Публичные API: добавляется один маршрут чтения; контракт `import-api-meta` расширяется обратно совместимо (новые необязательные поля).
- Зависимость: формат индекса и manifest плагина определяется change `publish-compose-preview-plugin`. Плагин лежит в том же бакете, что и клиент (отдельный префикс); общий origin принят как риск и описан в README клиента.
- Проверка: `cd backend-kt && ./gradlew build` (detekt, spotless, тесты), `cd frontend-kt && ./gradlew build`, `cd js/apps/client && npm run build && npm test`, браузерная проверка с локальным сервером плагина.
