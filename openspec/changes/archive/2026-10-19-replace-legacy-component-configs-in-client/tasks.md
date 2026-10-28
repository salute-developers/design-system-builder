## 1. Модель компонентов

- [x] 1.1 `api/componentModelEnrichment.ts`: `webParamsByProperty`, `variationNamesByProperty`, `templateLookup`, `enrichApi` с тестами.
- [x] 1.2 `componentRepository.loadComponentData`: для web — `property-platform-params`, `property-variations`, `component-config/web-adapter` через `readEditor`; заполнение `platformMappings.web` и `variations`; тест загрузчика с `versionId`.
- [x] 1.3 Моки новых запросов в `themeEditorRepository.test.ts`, `ColorTokensScreen.test.tsx` и `scripts/*-browser-test.mjs`; мёртвые моки `component-configs` удалить.

## 2. Удаление legacy-кода клиента

- [x] 2.1 Удалить `utils/api.ts`, `DesignSystem.create`, `DesignSystem.get`, `updateDesignSystemData`, мастер `popup/*`, загрузку по имени и версии в `useDesignSystem` и `Main.tsx`.
- [x] 2.2 `designSystemSave`: без fallback без `tenantId`; импорт на странице Debug — через `importDesignSystemToProject` с тестом.
- [x] 2.3 `grep -rn "ds/legacy" js/apps/client/src` не находит вызовов.

## 3. Проверка

- [x] 3.1 `cd js/apps/client && npm test && npx tsc -b`; `cd js && npm run build`.
- [x] 3.2 [внешняя проверка] На локальном контуре редактор темы `base` открывается, у свойств компонентов есть web-параметры, сетевых запросов к `/ds/legacy/**` нет.
