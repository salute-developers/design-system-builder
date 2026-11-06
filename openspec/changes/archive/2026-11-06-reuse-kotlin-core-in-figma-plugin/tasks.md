## 1. Общие модули входа

- [x] 1.1 Добавить `oauthError` в `TokenExchangeException` и разбор кода отказа в `KtorTokenExchangeClient`; тесты на отказ OAuth, `5xx` и неполный ответ
- [x] 1.2 Добавить порт `DeviceAuthorizationClient` в `core-auth` и `KtorDeviceAuthorizationClient` в `core-network`; тесты с `ktor-client-mock`
- [x] 1.3 Добавить `DeviceLoginFlow` в `commonMain` `feature-auth`; перенести сценарии из тестов `deviceFlow`: интервал, `slow_down`, сетевой сбой, отмена, истечение срока

## 2. Общий клиент токенов темы

- [x] 2.1 Добавить `ThemeTokensClient` и `ThemeContext` в `feature-ds/application`
- [x] 2.2 Добавить `HttpThemeTokensClient` в `feature-ds/data`: версии, четыре маршрута токенов, `versionId`, отказы; тесты с `ktor-client-mock`
- [x] 2.3 Добавить признак `named` в `DesignSystemTenant` без изменения поведения CLI и IDE

## 3. Модуль `:plugins:figma-core`

- [x] 3.1 Создать модуль: цель `browser()` для сборки, `nodejs()` для тестов, ES-модули и `.d.mts`; обновить `kotlin-js-store/yarn.lock`
- [x] 3.2 Реализовать `PluginSession` и `SessionStorage`; перенести все сценарии сессии из `auth.test.ts`, включая выход во время записи
- [x] 3.3 Реализовать `DsBuilderCore`, `CoreFailure`, передачу `AbortSignal` и соответствие ответов типам из `api/types.ts`; тесты
- [x] 3.4 Добавить задачу `syncFigmaPluginCore` и описать модуль в `frontend-kt/AGENTS.md`

## 4. Плагин на TypeScript

- [x] 4.1 Добавить запуск Gradle в сборку, `verify:figma-plugin` и тесты; добавить `src/ui/core/generated` в `.gitignore`
- [x] 4.2 Написать переходник к `DsBuilderCore` с переводом `CoreFailure` в `ApiError` и прежние сообщения; тесты
- [x] 4.3 Перевести `App.tsx`, `LoginScreen.tsx` и `index.tsx` на переходник; обновить тесты экранов
- [x] 4.4 Удалить `httpClient.ts`, `authEndpoints.ts`, `deviceFlow.ts`, `session.ts`, `dsBuilderApi.ts` и их тесты
- [x] 4.5 Добавить тест на отсутствие `fetch` и путей `/api/` в коде окна и проверку порога 800 КиБ для `dist/ui.html`

## 5. CI

- [x] 5.1 Добавить JDK и кеш Gradle в задание `figma-plugin` в `validate-js.yml`; запускать его при изменении используемых Kotlin-модулей

## 6. Проверка

- [x] 6.1 Запустить `tools/verify fast --change reuse-kotlin-core-in-figma-plugin`
- [x] 6.2 Провести независимое ревью и исправить замечания
- [x] 6.3 Запустить `tools/verify full --change reuse-kotlin-core-in-figma-plugin`
- [x] 6.4 Проверить, что CLI, MCP и плагин для Android Studio собираются и их тесты проходят после изменений в общих модулях
- [x] 6.5 Записать итоговый размер `ui.html` в описание PR
- [x] 6.6 [внешняя проверка] В Figma Desktop с локальным gateway пройти вход, восстановление сессии после перезапуска, выбор контекста и версии, просмотр токенов и выход
- [x] 6.7 [внешняя проверка] Убедиться, что сессия, сохранённая сборкой на TypeScript, восстанавливается новой сборкой без повторного входа
