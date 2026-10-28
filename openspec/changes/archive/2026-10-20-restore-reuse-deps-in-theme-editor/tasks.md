## 1. Клиент

- [x] 1.1 `componentModelEnrichment.ts`: тип `ComponentDependencyDto` и `collectDependencies` — оба типа, перевод id в имена по компонентам дизайн-системы, пропуск чужих связей, сортировка по `order` (null как 0) и имени.
- [x] 1.2 `componentRepository.loadComponentData`: запрос `GET {root}/component-deps` через `readEditor`, `deps` каждого компонента.
- [x] 1.3 Тесты: `reuse` и `compose` у одного родителя, чужая связь пропущена, порядок; загрузчик отдаёт `deps` AvatarGroup.

## 2. Проверка

- [x] 2.1 `cd js/apps/client && npm test && npx tsc -b`; `cd js && npm run build`.
- [x] 2.2 `tools/verify fast/full --change restore-reuse-deps-in-theme-editor`.
- [x] 2.3 [внешняя проверка] На локальном контуре у всех 21 связи `base` родитель получает ребёнка в `deps` с верным типом; AvatarGroup, ButtonGroup, ChipGroup, Popover открываются в редакторе без ошибки.
