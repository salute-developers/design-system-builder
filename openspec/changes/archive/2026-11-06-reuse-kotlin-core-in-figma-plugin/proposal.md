## Why

Плагин Figma общается с бэкендом через свой клиент на TypeScript, поэтому в DS Builder появляется второй код той же интеграции, который надо поддерживать отдельно от CLI, MCP и плагина для Android Studio. Требование команды: все клиенты переиспользуют Kotlin-модули `core-*`, а интеграция с бэкендом написана в одном месте. Делать это надо до экспорта в Figma, иначе клиент на TypeScript вырастет ещё больше.

Проверка показала, что вариант рабочий: Kotlin/JS с `core-*` без правок собрался для браузера и прошёл вход, выбор контекста и чтение токенов в окне Figma. `ui.html` вырос с 165 до 695 КиБ, и этот рост согласован.

## What Changes

- Новый модуль `:plugins:figma-core`: Kotlin/JS для браузера с API для TypeScript. Он отвечает за всё общение окна плагина с бэкендом.
- Device flow и выход переносятся в общие Kotlin-модули, обновление токена идёт через существующий `TokenExchangeClient`.
- `KtorTokenExchangeClient` сохраняет код отказа OAuth: сейчас `invalid_grant` неотличим от других ошибок.
- Новый общий клиент чтения токенов темы в `feature-ds`: определения, значения, типографика и размеры на границе версии.
- Сессия плагина и повтор после `401` переносятся из TypeScript в Kotlin с сохранением поведения: начатое до выхода обновление не возвращает токены.
- Из плагина удаляются `httpClient.ts`, `authEndpoints.ts`, `deviceFlow.ts`, `session.ts` и `dsBuilderApi.ts`. Экраны на React, `bridge`, основной поток и разбор значений для показа остаются.
- Сборка плагина собирает Kotlin-модуль через Gradle; результат не хранится в Git. Задание CI плагина получает JDK.
- Поведение для пользователя не меняется.

## Capabilities

### New Capabilities

- `figma-plugin-shared-core`: окно плагина работает с бэкендом только через общие Kotlin-модули.

### Modified Capabilities

Нет: требования `figma-plugin-authentication` и `figma-plugin-token-browser` не меняются, они остаются проверкой того, что поведение сохранилось.

## Impact

- **frontend-kt:** новый модуль `:plugins:figma-core`; `core-auth`, `core-network`, `feature-auth`, `feature-ds` получают новые общие контракты; обновляется `kotlin-js-store/yarn.lock`; `frontend-kt/AGENTS.md` описывает новый модуль. CLI, MCP и плагин для Android Studio продолжают работать как раньше.
- **js:** `js/apps/figma-plugin` теряет клиент API и логику сессии и получает тонкий переходник к Kotlin-модулю; меняются скрипты сборки, `verify:figma-plugin` и `.gitignore`.
- **CI:** `validate-js.yml` ставит JDK и реагирует на изменения в используемых Kotlin-модулях.
- **backend-kt:** без изменений. API, CORS и клиент Keycloak остаются из первого этапа.
- **Размер:** `ui.html` около 700 КиБ вместо 165 КиБ.
