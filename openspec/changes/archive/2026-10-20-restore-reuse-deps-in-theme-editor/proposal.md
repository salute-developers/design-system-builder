## Why

Модель компонентов редактора тем (`componentRepository`, дополненная change `replace-legacy-component-configs-in-client`) не заполняет зависимости компонентов (`deps`). Превью собирает связанные компоненты по `deps`. Из-за этого не доходят все 21 связь базовой дизайн-системы, в том числе 18 связей `reuse`: AvatarGroup → Avatar, ButtonGroup → Button, ChipGroup → Chip, TextFieldGroup → TextField, Popover → Button, Sheet и другие. Стори, которые берут вложенный компонент из `relatedComponents`, падают (`Element type is invalid … got: undefined` у AvatarGroup). Остальные рендерят ребёнка без темы дизайн-системы. Legacy-ручка db-service отдавала связи обоих типов.

## What Changes

- `componentRepository.loadComponentData` дополнительно читает `GET /api/projects/{projectId}/ds/component-deps` через `readEditor` (с `versionId`). Он строит `deps` каждого компонента из связей обоих типов (`compose` и `reuse`), сопоставляя `parentId`/`childId` с именами по компонентам дизайн-системы. Порядок — по `order`.
- Связь, у которой родитель или ребёнок не входит в дизайн-систему, пропускается.
- Web-адаптер, ds-service и генератор не меняются.

## Capabilities

### New Capabilities
- (нет)

### Modified Capabilities
- `tenant-aware-theme-editor`: модель компонентов содержит зависимости обоих типов из `component-deps`.

## Impact

- `js/apps/client/src/api/componentModelEnrichment.ts` (`collectDependencies`), `js/apps/client/src/api/componentRepository.ts` и их тесты.
- Один дополнительный GET при открытии редактора, права те же: `components:read`.
