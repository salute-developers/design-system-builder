# Proposal

## Why

`dsbuilder components fetch` дополнительно скачивал legacy-снимок `component-configs.json` через
`GET /ds/legacy/design-systems/{name}/component-configs`. Снимок читала только локальная web-генерация,
а теперь она собирает модель из выгрузки `components/`, `web-adapter.json` и маппингов установленного пакета
(архивы `2026-10-07-generate-components-from-fetched-package`, `2026-10-08-web-adapter-file`).
Снимок больше никому не нужен, но каждый fetch делает лишний запрос и падает, если legacy-ручка недоступна.

## What Changes

- **BREAKING** `components fetch` (и `ds fetch`) больше не запрашивает legacy-ручку и не пишет
  `.sdds/component-configs.json`; строка `Component configs: …` из вывода убрана. Уже скачанный файл не удаляется.
- Удаляются порты `ComponentConfigsSnapshotSource`/`ComponentConfigsSnapshotWriter` и их реализации в
  `feature-components`, поле `snapshotPath` результата fetch.
- Web-адаптер описывается самостоятельно, без ссылки на снимок.
- Legacy-ручка в db-service остаётся: ею пользуется web-клиент билдера.

## Impact

- `frontend-kt/feature-components`: `ComponentConfigsSnapshotPorts.kt`, `ComponentConfigsSnapshotAdapters.kt`
  (удаляются), `FetchComponentsUseCase`, DI, тесты.
- `frontend-kt/cli`: вывод `components fetch`, тесты, `USAGE.md`.
- Спецификация `cli-components`.
