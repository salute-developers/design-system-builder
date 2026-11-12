# component-seeds-writer Specification

## Purpose
Определяет обновление `component-seeds.json` ds-service, из которого заполняется каждая новая дизайн-система: команда `seeds:update` в `js/cli` переносит в сиды названные компоненты и appearance из пакета компонентов в формате `dsbuilder components fetch`.
## Requirements
### Requirement: Обновление сидов из пакета компонентов

Команда `npm run seeds:update` в `js/cli` SHALL читать пакет компонентов в формате `dsbuilder components fetch` (`meta.json` и `<component>_<style>_config.json`) и записывать в `component-seeds.json` ds-service только компоненты и appearance, названные флагами `--component=<Имя>` или `--component=<Имя>:<appearance>`. Записи, которые команда не называет, MUST остаться без изменений.

#### Scenario: Новый компонент

- **WHEN** developer runs `seeds:update --component=Attach`, а в сидах нет `Attach`
- **THEN** в `components` MUST появиться запись `Attach` со всеми appearance пакета, вариациями, стилями и привязками свойств к вариациям
- **THEN** записи компонентов MUST быть упорядочены по имени

#### Scenario: Дополнительный appearance существующего компонента

- **WHEN** developer runs `seeds:update --component=TextField:clear`
- **THEN** в записи `TextField` MUST появиться или замениться appearance `clear`
- **THEN** остальные appearance `TextField` MUST остаться без изменений, а вариации, стили и привязки свойств MUST дополниться тем, что использует `clear`

#### Scenario: Компонент без значений

- **WHEN** у компонента в пакете нет ни вариаций, ни значений (ViewContainer, Flow)
- **THEN** запись MUST содержать appearance `default` без значений

### Requirement: Значения сидов в формате ds-service

Команда SHALL переводить значения native-формата в значения сидов.

#### Scenario: Ссылка на токен

- **WHEN** значение свойства — имя токена из `token-definitions.json` ds-service
- **THEN** оно MUST быть записано как `token`
- **WHEN** значение — число, строка CSS или имя, которого нет в определениях токенов (типографика `body.l.bold`)
- **THEN** оно MUST быть записано строкой в `value`

#### Scenario: Состояния

- **WHEN** у значения есть `states`
- **THEN** каждое состояние MUST быть записано отдельным значением того же свойства с полем `state`

#### Scenario: Шаблоны web-параметров

- **WHEN** команда пишет значения
- **THEN** она MUST NOT писать `adjust`: шаблоны web-параметров живут в `web-adapter.json`, а не в базе

### Requirement: Связи и проверка

Команда SHALL принимать связи флагом `--dependency=<Родитель>:<Ребёнок>:<reuse|compose>` и заменять ими связи названных компонентов-родителей. Результат SHALL проходить тесты ресурса сидов ds-service и инициализацию новой дизайн-системы.

#### Scenario: Связи reuse

- **WHEN** developer passes `--dependency=Group:Button:reuse`
- **THEN** в `dependencies` MUST быть запись `{ parent: "Group", child: "Button", type: "reuse" }` с порядком по позиции флага

#### Scenario: Формат файла

- **WHEN** команда записывает файл
- **THEN** файл MUST быть компактным JSON без перевода строки в конце, как текущий `component-seeds.json`
- **THEN** повторный запуск с теми же входными данными MUST давать тот же файл

