## 1. Контракт

- [x] 1.1 Добавить необязательное поле `family` в `preview-payload.schema.json`
- [x] 1.2 Добавить `family` в фикстуру `web-button.json` и описать поле в `README.md` контракта
- [x] 1.3 Пересчитать `CONTRACT.sha256` через `fingerprint.sh`

## 2. Клиент

- [x] 2.1 Добавить `family` в `PreviewThemeValue` и заполнять его из `name` в `normalizeFontFamily`
- [x] 2.2 Проверить `family` в `webTokenValues.test.ts` и в сборке по снимку базы в `webAssembler.test.ts`

## 3. Плагин

- [x] 3.1 Добавить `family` в `protocol.ts` и проверку строки в `payload.ts`
- [x] 3.2 Заменить `fontFamilyName` на `fontFaceName` и `fontFamilyCss` во всех местах использования
- [x] 3.3 Реализовать `uniqueFontFamilies`, применить её в `resolvePayload` и убрать повторы правил `@font-face`
- [x] 3.4 Покрыть в `resolve.test.ts` все сценарии спецификации, а в `render.test.tsx` шрифт области превью

## 4. Проверки

- [x] 4.1 Запустить тесты и typecheck `js/apps/client` и `js/apps/preview-web-plugin`
- [x] 4.2 Запустить `npm run build` в `js` и проверки контракта в `backend-kt`
