## 1. Плагин: реестр всех компонентов

- [x] 1.1 Скопировать story из `js/apps/client/src/stories` (57 файлов и их вспомогательные модули) в `js/apps/preview-web-plugin/src/stories`; минимально поправить те, что не собираются или падают на `plasma-new-hope` 0.386.0, с комментарием о причине
- [x] 1.2 Реестр `src/registry.ts`: все 63 компонента `componentMapper` клиента в том же порядке story; запись `{stories, tokens?, coreConfig?}`; перенос `coreTokensByComponent` и `coreConfigNameByComponent` в `src/cssVariables.ts`
- [x] 1.3 Манифест: `components` — ключи реестра; тест манифеста сверяет список с реестром и наличие компонентов в `api-meta.json`

## 2. Плагин: связанные компоненты и несколько story

- [x] 2.1 Разбор `web.relatedComponents` и `web.relatedProperties` в `src/payload.ts` (ошибки — `invalid_payload` с путём)
- [x] 2.2 `buildRelatedComponents`: конфиг темы из web-значений через CSS-переменные ядра, `mergeConfig` с конфигом ядра, `<Имя>` и `<Имя>Config`; передача story пропсом `relatedComponents`; `relatedProperties` в CSS-переменные области
- [x] 2.3 `describe` с необязательным `storyId`, `stories` в описании, выбор story по `example.id`, код `story_not_found`
- [x] 2.4 Тесты: смоук по каждому компоненту и каждой story реестра; `ButtonGroup` получает `relatedComponents.Button` с CSS-переменными ядра `Button`; токены `TabItem` из `tabsTokens`; `Skeleton` через `lineSkeletonConfig`; `describe` со `storyId` и `story_not_found`

## 3. Клиент: payload и выбор story

- [x] 3.1 Вынести обход `createThemeConfig` и `createRelatedComponentVars` до `toCSSVariables` в `controllers/componentPreview/componentVars.ts`; React-путь переходит на него без изменения поведения
- [x] 3.2 `assembleWebPreviewPayload` заполняет `web.relatedComponents` (выбранный компонент и дочерние из зависимостей) и `web.relatedProperties` (зависимости `compose`)
- [x] 3.3 `session.describeComponent(componentId, storyId?)` и передача `storyId` из `ComposePreviewFrame`/слота; тип `stories` в описании
- [x] 3.4 `ComponentEditorPreview`: выбор story в режиме плагина по `description.stories`, `describe` с `storyId`, сброс аргументов, `example.id`
- [x] 3.5 Тесты: `relatedComponents` и `relatedProperties` совпадают с данными `createThemeConfig` и `createRelatedComponentVars` для фикстурного компонента с зависимостями; `describeComponent` передаёт `storyId`; выбор story в режиме плагина

## 4. Контракт

- [x] 4.1 `backend-kt/preview/contract/README.md`: поля `web.relatedComponents`, `web.relatedProperties`, `storyId` в `describe`, `stories` в описании; общие фикстуры и `CONTRACT.sha256` не меняются

## 5. Локальные проверки

- [x] 5.1 `npm test`, `npx tsc -b`, `npm run build` в `js/apps/preview-web-plugin`
- [x] 5.2 `npm test`, `npx tsc --noEmit`, `npm run build` в `js/apps/client`
- [x] 5.3 `backend-kt/preview/contract/fingerprint.sh --check`; `openspec validate add-web-preview-plugin-components --strict`
- [x] 5.4 Пересобрать сервис `preview-web-plugin` на локальном контуре

## 6. Проверки до архивирования

- [x] 6.1 [внешняя проверка] В debug-режиме «React | Плагин» дают одинаковый результат для `ButtonGroup`, `Tooltip`, `Drawer`, `Select` (обе story), `Skeleton` (три story), `Tabs`; расхождения у компонентов, изменившихся между 0.378 и 0.386, записаны — переключатель «React | Плагин» удалён в unify-web-preview-payload; вместо него все компоненты сравнены со старым клиентом по скриншотам
