## Context

`componentRepository.loadComponentData` собирает модель `Meta[]` редактора. Поле `deps` не заполняется.

Превью (`createRelatedComponents`, `createRelatedComponentVars` в `ComponentEditor.utils.ts`) берёт из `deps` имена детей:
- для `reuse` отдаёт ребёнку полный конфиг темы;
- для `compose` кладёт его переменные на сцену.

ds-service хранит связи в `component_deps` глобально, по id компонентов. Он отдаёт их `GET /api/ds/component-deps` массивом `{id, parentId, childId, type, order}`.

## Goals / Non-Goals

**Goals:**
- `deps` модели содержит все связи `component_deps` между компонентами дизайн-системы с их типом, в порядке `order`.
- Стори с вложенными компонентами (AvatarGroup, ButtonGroup, ChipGroup, TextFieldGroup, Popover, Sheet, Steps, Tabs, SegmentGroup) получают детей из `relatedComponents`.

**Non-Goals:**
- Изменение контракта web-адаптера или генератора.
- Отдельная ручка зависимостей по дизайн-системе в ds-service.

## Decisions

- **Источник — `GET /component-deps`.** Ручка уже есть и возвращает все связи слоя. Компоненты дизайн-системы и платформы загрузчик уже знает: по ним id переводятся в имена и отсекаются чужие компоненты. Вызов добавляется в тот же `Promise.all` через `readEditor`, поэтому учитывает `versionId`.
- **Тип и порядок** берутся из связи как есть. `order: null` считается `0`, как в web-адаптере (`ExposedComponentWebAdapterRepository`). При равенстве порядок — по имени ребёнка, чтобы модель была детерминированной.
- **Сборка** — чистая функция `collectDependencies` в `api/componentModelEnrichment.ts`. Её тест проверяет:
  - `reuse` и `compose` у одного родителя;
  - `order: null` и тай-брейк;
  - пропуск чужих связей.

  Тест загрузчика проверяет `deps` AvatarGroup.

## Risks / Trade-offs

- [Компонент идентифицируется парой (имя, платформа), а модель редактора — именем] → загрузчик берёт компоненты одной платформы, поэтому одноимённые web- и нативный компоненты не смешиваются.
- [Список связей глобальный и растёт с числом компонентов] → это десятки записей, один запрос. При росте можно добавить фильтр по дизайн-системе в ds-service отдельным change.
