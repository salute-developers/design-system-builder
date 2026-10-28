## 0. Фикстура до удаления React-пути

- [x] 0.1 Снять с текущего React-пути клиента (`createComponentVars` + `createThemeVars` + `createRelatedComponentVars`/`createThemeConfig`) CSS-переменные для набора стилей `Button`, `ButtonGroup`, `Tabs`/`TabItem`, `Typography` в обоих режимах и сохранить фикстурой плагина вместе с соответствующими payload нового формата

## 1. Контракт

- [x] 1.1 Схема v1 `backend-kt/preview/contract/schemas/v1/preview-payload.schema.json`: `asset.type` + `WOFF`, `WOFF2`; `typography.fontStyle?`; у `style` необязательные `variation`, `name`, `default`, `invariant`
- [x] 1.2 Фикстуры: общая valid с `styles` связанного компонента и ресурсом `WOFF2`; переписать `fixtures/v1/web/valid/web-button.json` в общий формат (без поля `web`); README — единый формат, новые поля, шаблоны и корректировки не передаются; удалить описание старого формата WEB
- [x] 1.3 `fingerprint.sh --write` и `--check`

## 2. Клиент: единый ассемблер

- [ ] 2.1 `draft.ts`: платформа компонента (`COMPOSE`/`WEB`), значения темы `android`/`web`, отбор свойств по параметрам платформы; стили связанных компонентов (все стили всех вариаций, инварианты, стиль по умолчанию) для `WEB`
- [ ] 2.2 `composePreview/webTokenValues.ts`: нормализация web-значений хранения (`rem`/`px`, цвета, тени, градиенты, типографика, `fontFamily` с `woff2`) в структуры схемы; диагностика `incompatible_value`
- [x] 2.2а Подмены значений web-параметров (`value` web-корректировок, 168 записей): для `WEB` значение свойства на платформе — `tokenRef` на токен подмены; проверить свойства с несколькими web-параметрами и разными подменами — при наличии остановиться и сообщить
- [ ] 2.3 `assembler.ts`: `payload.platform` по платформе draft, `styles` с `variation`/`name`/`default`/`invariant`, `surface.background`, цветовые токены окружения и шрифт тела в `theme` для `WEB`; шаблоны и web-корректировки не передаются
- [ ] 2.4 Удалить `webPayload.ts`, тип `WebPreviewPayload`/поле `web`, их экспорт и тесты; web-превью в `ComponentEditorPreview` — только через плагин на общем ассемблере
- [ ] 2.5 Тесты: ассемблер для `WEB` (свойства по имени, `states`, тема web в единицах протокола, отбор по web-параметрам, `styles` связанных компонентов и их токены); нормализация на всех web-значениях темы `base`; payload проходит схему; Compose-тесты без изменений

## 3. Клиент: удаление web-рендера

- [x] 3.1 Проверить потребителей `createThemeVars`, `createComponentVars`, `createThemeConfig`, `createRelated*`, `componentVars.ts`, `coreTokens.ts`, `useStory`; общую часть, нужную не превью (например, разделу «Цвета»), перенести без знания web-библиотеки
- [x] 3.2 Удалить React-путь `ComponentEditorPreview`, `src/stories`, `hooks/useStory.ts`, `controllers/componentPreview` и функции сборки конфигов в `ComponentEditor.utils.ts`; переключатель «React | Плагин» убрать
- [x] 3.3 Без плагина (нет адреса, манифест недоступен, компонента нет в манифесте) область превью показывает «Превью недоступно» с причиной, панель настройки работает
- [x] 3.4 Тесты: web-компонент рисуется только плагином; сообщения недоступности; панель настройки без плагина; удалённые тесты React-пути убраны

## 4. Web-плагин: разрешение payload

- [x] 4.1 Перенести `js/cli/.sdds/web/web-adapter.json` в плагин (шаблоны многозначных свойств); `js/cli` продолжает читать свой файл до отдельного изменения
- [x] 4.2 `src/resolve/meta.ts`: индекс `api-meta.json` (компонент, свойство, состояние → `paramName`)
- [x] 4.3 `src/resolve/tokens.ts`, `typography.ts`, `templates.ts`: `tokenRef`, `alpha`, единицы px→rem, цвета, тени, градиенты, типографика в параметры ядра, шаблоны из `web-adapter.json`
- [x] 4.4 `src/resolve/theme.ts`: CSS-переменные окружения из цветовых токенов, фон из `surface.background`, шрифт тела, `@font-face` из `assets`
- [x] 4.5 `src/resolve/related.ts`: конфиги связанных компонентов из `styles`, общие переменные зависимостей `compose`; `resolvePayload` — чистые функции без DOM и React, предупреждения `unmapped_property`
- [x] 4.6 `payload.ts` и `render.tsx` на новом формате; `invalid_payload` для поля `web` и CSS-строк; удалить разбор старых полей
- [x] 4.7 Тесты: `resolvePayload` по всем пунктам; совпадение с фикстурой из 0.1; смоук по реестру на новом формате; `invalid_payload` на старом

## 5. OpenSpec

- [x] 5.1 Убрать из незаархивированных `add-web-preview-plugin-pilot` и `add-web-preview-plugin-components` требования к старому формату payload `WEB` (поле `web`, CSS-строки, `relatedComponents`/`relatedProperties`) и к React-превью как запасному, с пометкой, что их заменяет это изменение

## 6. Локальные проверки

- [x] 6.1 `npm test`, `npx tsc --noEmit`, `npm run build` в `js/apps/client`
- [x] 6.2 `npm test`, `npx tsc -b`, `npm run build` в `js/apps/preview-web-plugin`
- [x] 6.3 `openspec validate unify-web-preview-payload --strict`; пересобрать сервис `preview-web-plugin` на локальном контуре

- [x] 6.4 После того как сверка 4.7 прошла и расхождения разобраны: удалить `js/apps/preview-web-plugin/test/fixtures/legacy-web-css/` и тест сверки с ней; сырые выгрузки `js/apps/client/src/composePreview/__fixtures__/`, нужные только для снятия снимка, удалить, нужные тестам ассемблера — оставить под нейтральным именем

## 8. Исправления после ручной проверки

- [x] 8.1 Псевдонимы `storyVariant`/`storyAppearance` в `describe` (Select, Dropdown, Combobox, List падали с «forbidden property variant»)
- [x] 8.2 Переменные типографики темы в плагине; все типографические токены экрана в `theme` (решение 8)
- [x] 8.3 Производные токены состояний `-hover`/`-active` — в плагине, удалить из ассемблера (решение 9)
- [x] 8.4 Убрать чтение web-шаблонов из клиента и `@salutejs/plasma-new-hope` из его `package.json` (решение 10)
- [x] 8.5 Канвас «Цвета» загружает выбранный компонент и связанные (решение 11)
- [x] 8.6 Тесты на 8.2–8.5; повторить сравнение 63 компонентов со старым клиентом

## 7. Проверки до архивирования

- [ ] 7.1 [внешняя проверка] plasma-android: `./fingerprint.sh --sync-to <plasma-android>/integration-core/preview-contract/src/commonMain/resources`, `jvmTest` модулей `preview-contract` и `preview-compose-plugin` зелёные, PR в plasma-android
- [ ] 7.2 [внешняя проверка] `Button`, `ButtonGroup`, `Tooltip`, `Tabs`, `Typography` рисуются web-плагином как раньше; без плагина — «Превью недоступно»; Compose-превью работает как раньше
