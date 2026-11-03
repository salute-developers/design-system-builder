## Why

Web-превью называет шрифт по токену (`"fontFamily.body"`), хотя в данных дизайн-системы есть настоящее имя `SB Sans Text`. Сгенерированная тема пишет `'SB Sans Text', sans-serif`, поэтому превью расходится с результатом генерации, а при недоступном шрифте текст уходит в шрифт браузера по умолчанию вместо шрифта без засечек.

## What Changes

- Токен `fontFamily` в Preview Protocol получает необязательное поле `family` с настоящим именем семейства. Версия протокола остаётся v1.
- Клиент передаёт `name` web-значения токена в `family`.
- Web-плагин использует `family` в `@font-face` и добавляет запасной `sans-serif` к значениям `font-family`.
- Токены с одним именем и одинаковыми файлами становятся одним семейством. Токены с одним именем и разными файлами отображаются по-разному: совпавший токен получает имя токена.
- Без `family` семейство по-прежнему называется по токену.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `preview-payload-contract`: токен `fontFamily` допускает поле `family`.
- `web-preview-plugin`: семейство шрифта разрешается по настоящему имени с запасным `sans-serif`.

## Impact

- `backend-kt/preview/contract`: схема `preview-payload.schema.json`, фикстура `web-button.json`, `README.md`, отпечаток `CONTRACT.sha256`. Код Kotlin не меняется.
- `js/apps/client/src/composePreview`: `webTokenValues.ts`, `types.ts`, тесты. Android-ветка ассемблера поле не заполняет.
- `js/apps/preview-web-plugin/src`: `protocol.ts`, `payload.ts`, `resolve/tokens.ts`, `resolve/theme.ts`, `resolve/typography.ts`, `resolve/index.ts`, тесты.
- `frontend-kt` не затрагивается, новых зависимостей нет.
- Изменение опирается на незакоммиченный change `fix-web-preview-review-remarks`: `fontLoads` использует то же имя семейства.
