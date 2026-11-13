## Why

Новая дизайн-система получает компоненты из `component-seeds.json` в `ds-service`. Файл собран один раз при переезде с db-service, а инструмент, который его писал (`component-seed-writer.ts` в db-service), удалён вместе с сервисом. Поэтому компоненты, заведённые после этого (27 web-компонентов из sdds-serv и дополнительные appearance `clear`, `transparent`, `has-wrapper`), есть только в базе стенда и в новые дизайн-системы не попадают; перенести тысячи значений в формат сидов вручную нельзя.

## What Changes

- В `js/cli` появляется команда `npm run seeds:update`: она читает пакет компонентов в формате `dsbuilder components fetch` и дописывает или заменяет в `component-seeds.json` только названные компоненты и appearance; остальные записи файла не меняются.
- Значение со ссылкой на токен из `token-definitions.json` ds-service записывается как `token`, остальное — как `value`; состояния — отдельными значениями с `state`; шаблоны web-параметров (`adjust`) не пишутся.
- Связи компонентов (`dependencies`) задаются флагами команды.
- В сиды добавляются 27 новых web-компонентов и appearance `clear`/`transparent`/`has-wrapper` из данных, импортированных из ядра и sdds-serv; правки, сделанные вручную на локальном стенде, в сиды не попадают.
- Тест ресурса сидов в `ds-service` обновляет контрольную сумму и счётчики.

## Capabilities

### New Capabilities

- `component-seeds-writer`: обновление `component-seeds.json` из пакета компонентов.

### Modified Capabilities

Нет.

## Impact

- **js**: `js/cli/src/component-seeds.ts`, `js/cli/src/component-seeds.test.ts`, скрипт `seeds:update` в `js/cli/package.json`.
- **backend-kt**: `ds-service/feature-components/src/main/resources/component-seeds.json` (данные), `ComponentSeedsResourceTest` (контрольная сумма и счётчики); код ds-service не меняется.
- **frontend-kt**: без изменений.
- Документация: скилл `add-component`, `js/cli/README.md`.
