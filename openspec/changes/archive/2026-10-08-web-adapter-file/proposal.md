# Proposal

## Why

Локальная web-генерация (`js/cli`) получала из базы два временных файла: `meta-template.json`
(шаблоны web-параметров) и `meta-dependencies.json` (compose-связи) через ручку `web-meta`
(архив `2026-10-07-generate-components-from-fetched-package`). Описание компонента туда не входило,
поэтому JSDoc обёрток сгенерированного пакета был пустым, а имя компонента в коде `js/cli` выводил
правилом из kebab-имени. Имя `web-meta` к тому же не отличало временное решение от постоянного
`web-api-meta.json`.

## What Changes

- Ручка `POST /ds/component-config/web-meta` заменяется на `POST /ds/component-config/web-adapter`.
  Ответ — массив записей по компонентам, как у `web-api-meta.json`: `componentName` (имя в написании
  `meta.json`), `name` (имя в коде, из `components.name`), `description` (из `components.description`),
  `compose` (дочерние компоненты пакета) и `styles.<style>.templates` (шаблоны web-параметров).
  Пустые поля не пишутся.
- `components fetch` для React сохраняет ответ как есть в один файл `.sdds/web/web-adapter.json`
  вместо двух. Порты и реализации в `feature-components` — `WebAdapterFile*`.
- `js/cli` берёт из `web-adapter.json` имя, описание, compose-связи и шаблоны; правило kebab → имя
  остаётся запасным путём для компонента без записи.
- Название «адаптер» отражает временность: постоянный источник web-маппингов — `web-api-meta.json`.
- `npm run generate:components` загружает `js/.env`, если он есть (`tsx --env-file-if-exists=../.env`):
  генератору нужен `NPM_PACKAGE_SCOPE`. `generate:theme` и `generate:api-meta` окружение не читают
  и `.env` не загружают.
- Подстановка смещений из поправок платформенных параметров в `/export` помечена TODO: она
  удаляется вместе с поддержкой таблиц `*_platform_param_adjustments`.

## Impact

- `js/services/db-service`: `db/export/webAdapter.ts`, роут `component-config-web-adapter.ts`, OpenAPI.
- `frontend-kt/feature-components`: `WebAdapterFilePorts.kt`, `WebAdapterFileAdapters.kt`,
  `FetchComponentsUseCase`, DI; `frontend-kt/cli`: вывод fetch, `USAGE.md`.
- `js/cli`: `src/component-source.ts`, `src/components.ts`, `package.json`, README.
- `js/services/db-service/src/db/export/componentExport.ts`: TODO у `loadPlatformOffsets`.
