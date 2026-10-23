## 1. Перенос инструмента в js/cli

- [x] 1.1 Скопировать `js/services/db-service/src/db/import-plasma-component.ts` в `js/cli/src/import-plasma-component.ts`, убрать импорты сидов (`component-seed`, `component-seed-writer`) и путь `dbDir`; добавить скрипт `import:plasma` в `js/cli/package.json`.
- [x] 1.2 Источник токенов темы: `readBaseThemeTokens` и `readShapeTokenPx` читают `.sdds/tenants/<тема>/meta.json` и `web/web_shape.json`; опции `--sdds` (по умолчанию `js/cli/.sdds`) и `--theme`; без темы — остановка с подсказкой `dsbuilder theme fetch`.
- [x] 1.3 Модуль `src/component-package.ts`: чтение и запись `meta.json`, имя файла и `componentName` в kebab-case как у `fetch`, замена записей компонента, удаление записей; преобразование `AppearanceInput`/`Prop`/`Row` в native-конфиг (`props`, `bindings`, `variations`, цвет и градиент в `default`).
- [x] 1.4 `emitSeeds` → `emitPackage`: запись конфигов через модуль пакета, манифест с `webTemplates` из `Prop.template`, связи `compose` в отчёт вместо патча `component_deps.ts`; `--remove` удаляет записи пакета; пустой компонент пишет запись с пустой конфигурацией.
- [x] 1.5 Удалить `src/db/import-plasma-component.ts` и скрипт `component:import` из db-service.

## 2. Тесты

- [x] 2.1 `src/import-plasma-component.test.ts` (`node:test`): фикстуры `tokens.ts` и `*.config.ts` с цветом по токену темы, группой типографики, радиусом по токену формы, многозначным отступом (шаблон), `disabled`, флагом; проверка native-конфига, `bindings` с дефолтами, `webTemplates` манифеста и отчёта.
- [x] 2.2 Тест модуля пакета: запись во временную директорию, повторная запись заменяет записи компонента и не трогает чужие, `--remove` удаляет только свои.
- [x] 2.3 Тест остановки без локальной темы.

## 3. Скилл и документация

- [x] 3.1 Переписать `.claude/skills/add-component/SKILL.md`: цепочка `dsbuilder theme fetch`, `npm run generate:api-meta`, `dsbuilder components import-api --platform react`, `npm run import:plasma`, решения по отчёту, `dsbuilder components push --platform react --from .sdds/components --apply`, связи через `POST /ds/component-deps`, стори клиента, проверка генератором; предупреждение про шаблоны нового компонента до change генератора.
- [x] 3.2 Обновить `js/docs/component-creation.md` и `js/cli/README.md`; убрать упоминания `component:import` из `js/CLAUDE.md`.

## 4. Проверка

- [x] 4.1 `cd js/cli && npm run typecheck && npm test`; `cd js/services/db-service && npm run build`.
- [x] 4.2 `cd js && npm run build`.
- [x] 4.3 [внешняя проверка] На локальном контуре полный круг для одного компонента из plasma: `theme fetch`, `import:plasma --apply`, `components push --platform react --apply` пакета, `components fetch` возвращает тот же конфиг компонента, в клиенте компонент виден в редакторе тем.
