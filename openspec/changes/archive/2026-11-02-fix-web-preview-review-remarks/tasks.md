## 1. Сплошной градиент

- [x] 1.1 Принять слой `{ kind: 'color', background }` в `normalizeGradient` (`webTokenValues.ts`)
- [x] 1.2 Добавить модульные тесты слоя и некорректного цвета в `webTokenValues.test.ts`
- [x] 1.3 Добавить сквозной тест `createComponentPreviewDraft` → ассемблер с токеном `dark.outline.default.accent-gradient-active` и значением-ссылкой на палитру в `webAssembler.test.ts`

## 2. Шрифты в плагине

- [x] 2.1 Вернуть `fontLoads` из `resolve/theme.ts` и добавить поле в `ResolvedPreview`
- [x] 2.2 Реализовать `waitForFonts` с общим пределом 5 секунд
- [x] 2.3 Дождаться шрифтов в `RenderedSignal` и передать незагруженные начертания в `RenderOutcome`
- [x] 2.4 Отправлять в `bridge.ts` warning `font_fallback` или `failure` с кодом `font_unavailable`
- [x] 2.5 Добавить тесты `waitForFonts`: успех, ошибка, таймаут, отсутствие `document.fonts`
- [x] 2.6 Добавить тесты `bridge.test.ts`: `success` не уходит до загрузки, `font_fallback`, `font_unavailable`

## 3. Хост

- [x] 3.1 Выводить warnings успешного результата в `ComposePreviewFrame.tsx` через `console.warn`
- [x] 3.2 Добавить тест в `ComposePreviewFrame.test.tsx`

## 4. Проверки

- [x] 4.1 Запустить тесты и typecheck `js/apps/client` и `js/apps/preview-web-plugin`
- [x] 4.2 Запустить `npm run build` в `js`
