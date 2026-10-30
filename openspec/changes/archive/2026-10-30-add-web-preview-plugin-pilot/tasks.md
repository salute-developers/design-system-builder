## 1. Контракт

- [x] 1.1 Описать в `backend-kt/preview/contract/README.md` payload платформы `WEB`: ключи `component.properties` — web-параметры, значения — литералы CSS, состояния — ключи с суффиксами `Hover`/`Active`, корневое поле `web` (`themeVariables`, `fontFamily`, `background`)
- [x] 1.2 Добавить фикстуру `backend-kt/preview/contract/fixtures/v1/web/valid/web-button.json` вне общих фикстур (не входит в `CONTRACT.sha256` и копию plasma-android, обоснование — в README контракта и design); тест схемы клиента проверяет `fixtures/v1/web/valid`

## 2. Приложение web-плагина

- [x] 2.1 Создать `js/apps/preview-web-plugin`: `package.json` (React 18, `styled-components` 5, `@salutejs/plasma-new-hope` и `@salutejs/plasma-icons` версий, установленных в клиенте), Vite с dev-сервером на `3011` и `server.cors`, TypeScript, Vitest, ESLint как в клиенте, `index.html` со шрифтами SB Sans
- [x] 2.2 `public/preview-plugin.json`: `schemaVersion 1`, `platform "web"`, `protocolVersion 1`, `entrypoint "index.html"`, `payloadBridge` с сообщениями `sdds.preview.*`, `components ["Button"]`
- [x] 2.3 Мост `src/bridge.ts`: `ready` после загрузки, `describe` → `description`, `payload` → `result` (успех после отрисовки), коды `component_not_found`, `invalid_payload`, `render_crashed` с `details`, приём только от родительского окна, ответ в origin отправителя — в форматах `ComposePreviewSession`
- [x] 2.4 `src/cssVariables.ts`: перенос `getCSSVariableName`/`toCSSVariables` из `coreTokens.ts` клиента; реестр `src/registry.ts` с `Button` (story и `buttonTokens`)
- [x] 2.5 Перенести story `Button` в `src/stories/Button.story.tsx`; `describeStory` по её аргументам (`boolean`, `singleChoice`, `string`, значения по умолчанию)
- [x] 2.6 Отрисовка `src/render.tsx`: фон, CSS-переменные темы и компонента, шрифт, story с `{...example.props, ...component.variations}`, error boundary
- [x] 2.7 Тесты плагина: мост (все сообщения и коды отказа), отображение ключей в CSS-переменные `Button` (в том числе `Hover`/`Active`), описание story, отрисовка по фикстуре `web-button.json`

## 3. Клиент: хост по платформе

- [x] 3.1 `composePreview/types.ts`: платформы `COMPOSE | WEB`, `compose | web` в манифесте, тип `WebPreviewPayload` с полем `web`
- [x] 3.2 `manifest.ts`: ожидаемая платформа параметром, отказ при несовпадении; тексты ошибок без «Compose»
- [x] 3.3 `environment.ts` и места вызова: проверка WebAssembly только для `compose`
- [x] 3.4 `config.ts`: `getWebPreviewPluginUrl()` из `VITE_WEB_PREVIEW_PLUGIN_URL`; `js/docker-compose.dev.yml` — значение по умолчанию `http://localhost:3011/` и сервис dev-сервера плагина
- [x] 3.5 `ComposePreviewHost`: параметр платформы; страница раздела монтирует провайдер web-платформы при заданном адресе web-плагина
- [x] 3.6 Тесты: манифест web принят для web и отклонён для compose и наоборот; без WebAssembly web-плагин загружается
- [x] 3.7 Хост не считает первое событие `load` iframe после назначения `src` перезапуском плагина (иначе `ready`, пришедший раньше `load`, терялся и хост ждал второго до таймаута 30 с); web-плагин повторяет `ready` на `load` окна; тесты на обе стороны

## 4. Клиент: payload и выбор рендерера

- [x] 4.1 Вынести общий обход стилей и инвариантов из `createComponentVars` и добавить `composePreview/webPayload.ts` `assembleWebPreviewPayload`
- [x] 4.2 `ComponentEditorPreview`: web-компонент, поддержанный манифестом web-плагина, рисуется через слот хоста web-платформы; панель аргументов story — по `describe`; иначе React-превью; переключатель «React | Плагин» в debug-режиме
- [x] 4.3 Тесты: `component.properties` web-payload совпадает с парами, которые `createComponentVars` передаёт в `toCSSVariables`, для фикстурного `Button` в двух режимах; payload проходит схему; выбор рендерера (плагин, React без адреса, React без компонента в манифесте, переключатель в debug-режиме)
- [x] 4.4 README клиента: web-плагин, `VITE_WEB_PREVIEW_PLUGIN_URL`, локальный запуск плагина

## 4а. Скорость загрузки плагина

- [x] 4а.1 Сервис `preview-web-plugin` в `js/docker-compose.dev.yml` раздаёт собранный бандл (`npm run build` и `npm run preview` на `3011`), а не dev-сервер; README клиента и плагина описывают оба режима
- [x] 4а.2 Провайдер web-платформы в `Components.tsx` прогревает плагин при входе в раздел, если у ДС есть web-компоненты; тест на прогрев

## 4б. Мета в плагине

- [x] 4б.1 Перевести плагин на `@salutejs/plasma-new-hope` 0.386.0; сгенерировать `public/api-meta.json` генератором `js/cli` из каталога плагина; `plasmaNewHopeVersion` и `apiMetaSha256` в манифесте; тест манифеста сверяет хеш, версию и наличие компонентов в мете
- [x] 4б.2 Вручную импортировать мету плагина в локальный ds-service (`dsbuilder components import-api --platform react --apply`), проверить, что повторный пробный прогон ничего не меняет

## 5. Локальные проверки

- [x] 5.1 `npm test`, `npx tsc --noEmit`, `npm run build` в `js/apps/preview-web-plugin`
- [x] 5.2 `npm test`, `npx tsc --noEmit`, `npm run build` в `js/apps/client`
- [x] 5.3 `openspec validate add-web-preview-plugin-pilot --strict`

## 6. Проверки до архивирования

- [x] 6.1 [внешняя проверка] На локальном контуре web `Button` рисуется web-плагином из `http://localhost:3011/`; смена стилей вариаций, режима темы, фона и аргументов story отражается в превью; в debug-режиме «React | Плагин» дают визуально одинаковый результат — проверено после unify-web-preview-payload и publish-web-preview-plugin: Button рисуется web-плагином, опубликованным в локальный MinIO
