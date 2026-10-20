## 1. Бэкенд: хранение версии меты (backend-kt/ds-service)

- [ ] 1.1 Добавить миграцию Flyway `V7__component_meta_versions.sql`: таблица `component_meta_versions` (платформа первичным ключом, `meta_version`, `meta_sha256`, `source`, `imported_by`, `imported_at`); не менять `schema-fingerprint.json` базовой схемы
- [ ] 1.2 Домен: `ComponentMetaVersion`, `MetaVersionOutcome` (`Recorded`, `Unchanged`, `Replaced`, `Conflict`, `NotProvided`)
- [ ] 1.3 Расширить `ImportApiMeta` и `ApiMetaRepository.import` версией и sha256; результат попытки возвращает `MetaVersionOutcome`
- [ ] 1.4 Data: таблица Exposed, запись версии в `ExposedApiMetaRepository` в той же транзакции по правилам из design (вставка, без изменений, замена, конфликт, пропуск); при `dryRun` ничего не писать, итог считать
- [ ] 1.5 Записывать версию, sha256 и итог в запись журнала `components:import-api-meta`
- [ ] 1.6 Presentation: расширить `ImportApiMetaRequest.Meta` (обе опции вместе, формат версии и sha256) и `ImportApiMetaResponse` (`metaVersion`); ответ `409` с кодом `meta_changed_without_version` и записанным значением
- [ ] 1.7 Application и presentation: use case и маршрут `GET /api/projects/{projectId}/ds/component-meta-versions/{platform}` с правом `components:read`, `404` при отсутствии записи, валидация платформы; зарегистрировать в `di`
- [ ] 1.8 Обновить `openapi/documentation.yaml`, манифест маршрутов и аудит потребителей в `contracts`; проверить, что gateway проксирует путь без изменений конфигурации, и добавить проверку в тест маршрутов gateway при необходимости

## 2. CLI (frontend-kt)

- [ ] 2.1 Домен и application: версия меты (`version`, `sha256`), хеширование байтов файла, чтение `preview-plugin.json` (`uikitComposeVersion`, `apiMetaSha256`) через порт чтения файла
- [ ] 2.2 Расширить `ImportApiMetaCommand`/`ImportApiMetaUseCase`: правила обязательности для `compose` при `--apply`, сверку sha256 с manifest, предупреждение при dry run
- [ ] 2.3 Расширить HTTP-источник: `meta.uikitComposeVersion`, `meta.sha256`; разбор `metaVersion` в ответе и ошибки `409`
- [ ] 2.4 Presentation: опции `--uikit-compose-version` и `--plugin-manifest` (взаимоисключающие), печать итога по версии, справка команды
- [ ] 2.5 Обновить `frontend-kt/cli/USAGE.md` примером импорта мета из билда плагина

## 3. Клиент (js/apps/client)

- [ ] 3.1 Конфигурация: `VITE_COMPOSE_PREVIEW_PLUGIN_BASE_URL`, `VITE_COMPOSE_PREVIEW_CHANNEL` (по умолчанию `current`), приоритет `VITE_COMPOSE_PREVIEW_PLUGIN_URL`; заменить условие включения на `isComposePreviewConfigured()` и обновить `themeEditorRepository.ts`
- [ ] 3.2 API-клиент чтения версии меты (`GET .../component-meta-versions/compose`), различие `404` и ошибок
- [ ] 3.3 Загрузка и проверка индекса канала (структура, отсутствие абсолютных адресов, отсутствие дублей версий), сравнение версий semver
- [ ] 3.4 `resolveComposePreviewPlugin`: выбор записи по таблице из design, предупреждения (`no-pin`, `older-build`, `no-matching-build`, `meta-mismatch`), кеш на время жизни страницы
- [ ] 3.6 Подключить выбор к `ComposePreviewFrame`/сессии, показать предупреждения в области Compose-preview, сообщения о недоступности
- [ ] 3.7 Передавать `apiMetaSha256` manifest в проверку `meta-mismatch`
- [ ] 3.8 Обновить `README.md` клиента: переменные, правило выбора, предупреждения, приоритет прямого адреса; заменить прежнее требование «отдельный origin» описанием принятого риска общего origin (плагин SDDS, раздельные префиксы бакета)
- [ ] 3.9 Задать переменные в `docker-compose.dev.yml` (прямой адрес по умолчанию сохраняется) и в `deploy-front-apps-dev.yml`, `deploy-front-apps-prom.yml` из переменных репозитория (значения зависят от домена плагина и появляются после его определения)

## 4. Тесты

- [ ] 4.1 ds-service: тесты репозитория на PostgreSQL по образцу `ApiMetaImportHttpPostgresIntegrationTest` (запись, без изменений, замена, конфликт, откат транзакции, dry run, пропуск при отсутствии полей)
- [ ] 4.2 ds-service: тесты маршрутов (`409` и тело, валидация полей, чтение: успех, `404`, нет права, неизвестная платформа, роль администратора для импорта без изменений)
- [ ] 4.3 CLI: тесты опций, хеширования, сверки с manifest, обязательности для `compose`, вывода итога и `409`
- [ ] 4.4 Клиент: Vitest на выбор записи (все строки таблицы), проверку индекса, semver-сравнение, кеш, приоритет прямого адреса
- [ ] 4.5 Клиент: тесты `ComposePreviewFrame` на показ предупреждений и недоступности; обновить существующие тесты `manifest`, `session`, `environment` при изменении конфигурации
- [ ] 4.6 Фикстуры индекса и manifest плагина из change `publish-compose-preview-plugin`: положительные и отрицательные (решить, где хранится каноническая копия)
- [ ] 4.7 Браузерная проверка (`npm run test:browser-smoke` или новый сценарий) со стендом: MinIO локального контура (`backend-kt/docker-compose.local.yml`) с билдом и индексом плагина, опубликованными из `plasma-android` через `previewPluginPublish`, и бэкенд с записанной версией; для быстрых тестов клиента допустим локальный HTTP-сервер с индексом

## 5. Проверка и завершение

- [ ] 5.1 `cd backend-kt && ./gradlew build`; `spotlessApply` для затронутых модулей, если `spotlessCheck` падает
- [ ] 5.2 `cd frontend-kt && ./gradlew build`
- [ ] 5.3 `cd js/apps/client && npm run build && npm test`
- [ ] 5.4 Локальный контур `./setup-local.sh`: применить `V7`, опубликовать плагин в MinIO контура (бакет с публичным чтением и CORS), импортировать мету с `--plugin-manifest`, открыть редактор и увидеть выбранный билд и предупреждения
- [ ] 5.5 Повторный импорт той же меты (идемпотентность) и импорт с изменённым sha256 при той же версии (отказ) на локальном контуре
- [ ] 5.6 Согласовать с владельцем инфраструктуры префикс плагина в бакете клиента, значения переменных для dev и prom, CORS бакета
