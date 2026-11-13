## Why

Ревью PR #137 нашло два расхождения web-превью с ADR-0006. Сплошной градиент из базовой дизайн-системы делает превью компонента недоступным, а плагин сообщает об успехе раньше, чем загружены шрифты темы, и подмена шрифта остаётся незаметной. Пользователь конструктора видит либо ошибку на рабочем токене, либо превью, которое выглядит готовым, но отрисовано не тем шрифтом.

## What Changes

- Web-нормализатор ассемблера принимает сплошной слой `{ kind: 'color', background }`, который готовит `projectThemeValue`.
- Web-плагин отправляет `success` только после завершения загрузки шрифтов темы; ожидание ограничено 5 секундами.
- Шрифт, не загрузившийся за это время или с ошибкой, при `allowFallback: true` даёт `success` с warning `font_fallback`, иначе `failure` с кодом `font_unavailable`.
- Хост превью выводит warnings успешного результата в консоль браузера: сейчас он их не читает.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `web-preview-plugin`: `success` отправляется после подготовки шрифтов, недоступный шрифт диагностируется явно.
- `compose-preview-payload-assembly`: сплошное значение градиента для `WEB` собирается в слой протокола.
- `compose-preview-host`: warnings успешного результата видны разработчику.

## Impact

- `js/apps/client/src/composePreview`: `webTokenValues.ts`, `ComposePreviewFrame.tsx`, тесты.
- `js/apps/preview-web-plugin/src`: `render.tsx`, `bridge.ts`, `protocol.ts`, `resolve/theme.ts`, `resolve/index.ts`, тесты.
- Формат `PreviewPayload` и версия протокола не меняются: появляются только новые код warning и код failure.
- `backend-kt` и `frontend-kt` не затрагиваются, новых зависимостей нет.
