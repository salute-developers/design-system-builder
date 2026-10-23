## Why

Редактор тем грузит компоненты через `componentRepository` (версии и журнал из `feature/ds-versions`): `design-system-components`, `components`, `appearances`, `component-config/export` и CRUD-ручки по каждому компоненту. Модель при этом теряет то, что отдавала legacy-ручка db-service `GET /ds/legacy/design-systems/{name}/component-configs`:

- web-параметры свойств (`platformMappings.web: null`): превью не получает CSS-переменных темы и рисует компоненты с умолчаниями ядра;
- панели вариаций свойств (`variations: null`): редактор не знает, в каких вариациях показывать свойство;
- шаблоны многозначных web-параметров (`0 $1`).

Кроме того, в клиенте остаётся мёртвый legacy-код: мастер создания дизайн-системы, загрузка по имени и версии, `utils/api.ts` с вызовами `/ds/legacy/**`. Импорт дизайн-системы из файла на странице Debug ходит в legacy-`create`.

## What Changes

- `componentRepository.loadComponentData` для платформы `web` дополнительно читает `GET /ds/property-platform-params`, `GET /ds/property-variations` и `POST /ds/component-config/web-adapter` через `readEditor` (с `versionId`). Он заполняет `platformMappings.web` (имена в порядке базы, шаблон поправки из `web-adapter`) и `variations` свойств. Сборка — чистые функции в `api/componentModelEnrichment.ts`.
- **BREAKING** для клиента: удаляются legacy-вызовы `saveDesignSystem`, `updateDesignSystem`, `loadDesignSystem` в `utils/api.ts`, `DesignSystem.create`, `DesignSystem.get`, `updateDesignSystemData`, мастер создания (`popup/*`), загрузка по имени и версии в `useDesignSystem`, fallback сохранения без контекста темы в `designSystemSave`.
- Импорт дизайн-системы из файла переводится на ds-service (`api/designSystemImport.ts`). Версию дизайн-системы импорт не публикует.
- Тесты и browser-скрипты клиента отвечают на новые запросы. Мёртвые моки `component-configs` удаляются.
- ds-service, gateway и db-service не меняются.

## Capabilities

### New Capabilities

- Нет.

### Modified Capabilities

- `tenant-aware-theme-editor`: требование «Редактор собирает модель выбранной темы» дополняется web-параметрами, вариациями и шаблонами свойств; клиент не обращается к `/ds/legacy/**` и не публикует версии сам.

## Impact

- `js/apps/client`:
  - новый `src/api/componentModelEnrichment.ts`, правка `src/api/componentRepository.ts`;
  - удаление `utils/api.ts`, `popup/*` и частей `controllers/designSystem`, `hooks/useDesignSystem.ts`, `pages/Main.tsx`, `pages/Main.utils.ts`;
  - новые `api/designSystemImport.ts` и `api/themeTokenValues.ts`;
  - тесты и `scripts/*-browser-test.mjs`.
- `backend-kt`, `frontend-kt`, `js/services/db-service`: без изменений.
