## Why

Пилот (`add-web-preview-plugin-pilot`) показал, что web-плагин с payload платформы `WEB` рисует `Button` так же, как React-превью, а мета и рендер берутся из одной версии `plasma-new-hope`. Остальные 62 web-компонента пока рисуются только в клиенте. Чтобы вынести знание о библиотеке из DS Builder, плагин должен уметь рисовать все компоненты, для которых в клиенте есть story.

Два места пилот не покрывал:
- **Связанные компоненты.** 16 story (`ButtonGroup`, `Drawer`, `Tooltip`, `Modal`, `Dropdown`, `Toast` и др.) рисуют дочерние компоненты через `relatedComponents`. Им нужен полный конфиг дочернего компонента в теме дизайн-системы: все стили всех вариаций и инварианты, а не только выбранный стиль. Для зависимостей типа `compose` нужны ещё и общие CSS-переменные родителя и потомка.
- **Несколько story у компонента.** Так у 16 компонентов: `Select`, `Skeleton`, `Tooltip` и др. В режиме плагина выбрать story сейчас нельзя.

> Формат payload `WEB` из этого изменения (CSS-строки, корневое поле `web`) и запасное React-превью заменены изменением `unify-web-preview-payload`.

## What Changes

- **Реестр web-плагина** содержит все компоненты `componentMapper` клиента — 63 записи. Story переносятся копиями из `js/apps/client/src/stories`. Таблицы исключений ядра (`coreTokensByComponent`, `coreConfigNameByComponent`) переносятся из `coreTokens.ts`. Манифест перечисляет все компоненты реестра.
- **Payload `WEB` расширяется полями в корневом `web`** без изменения JSON-схемы:
  - `relatedComponents` — конфиги компонентов из зависимостей выбранного (и его самого) в теме ДС: стили по умолчанию, значения web-параметров по стилям каждой вариации, инварианты;
  - `relatedProperties` — значения web-параметров связанных компонентов для зависимостей `compose`, по имени компонента.

  Плагин собирает из них `relatedComponents` для story так же, как `createRelatedComponents` клиента.
- **Несколько story.** `describe` принимает необязательный `storyId` и возвращает в описании список story компонента (`stories`). `example.id` выбирает story. В режиме плагина клиент показывает выбор story по этому списку.
- **Смоук-проверка в плагине:** каждая запись реестра рисуется по базовому payload без ошибок.
- Story в клиенте остаются запасным React-превью до публикации web-плагина через бэкенд.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `web-preview-plugin`: реестр со всеми web-компонентами, связанные компоненты, несколько story и выбор story через `describe`.

## Impact

- **js / `js/apps/preview-web-plugin`:**
  - `src/stories/*` — 57 файлов story;
  - `src/registry.ts`, `src/cssVariables.ts` — исключения ядра;
  - `src/render.tsx` — сборка `relatedComponents`;
  - `src/describe.ts` и `src/bridge.ts` — `storyId` и `stories`;
  - манифест, тесты, смоук по реестру.
- **js / `js/apps/client`:**
  - `composePreview/webPayload.ts` — связанные компоненты из тех же данных, что `createRelatedComponents` и `createRelatedComponentVars`;
  - `session.ts` — `describeComponent(componentId, storyId?)`;
  - `types.ts` — `stories` в описании;
  - `ComponentEditorPreview` — выбор story в режиме плагина;
  - тесты.
- **backend-kt:** `backend-kt/preview/contract/README.md` — описание новых полей `web` и `describe`. JSON-схема и общие фикстуры не меняются.
- **frontend-kt** и ds-service не затрагиваются.
- **Вне скоупа:**
  - публикация web-плагина через ds-service и S3;
  - удаление story, `useStory` и `coreTokens.ts` из клиента;
  - перевод React-превью клиента на версию библиотеки плагина;
  - состояния через `states` протокола.
