## ADDED Requirements

### Requirement: Единственный web-адаптер в CLI

`js/cli/src/data/web-adapter.json` SHALL быть единственным файлом с именами, описаниями, шаблонами web-параметров и
`compose`-связями компонентов среди файлов, хранящихся в Git. Выгрузка `dsbuilder` в `.sdds/web` и опция `--web`
генератора этим требованием не затрагиваются. Файл SHALL входить в публикуемый пакет генератора; его SHALL читать
генератор и модуль `web-mapping` пакета. Шаблоны web-параметров нового компонента MUST NOT заноситься в базу
`ds-service`.

#### Scenario: Файл в опубликованном генераторе

- **WHEN** генератор установлен из npm-пакета `@sddsjs/design-system-builder-generator`
- **THEN** `generate:components` MUST найти `web-adapter.json` внутри установленного пакета

#### Scenario: Запись нового компонента

- **WHEN** в базовую ДС добавлен web-компонент, у свойств которого есть шаблоны многозначных значений
- **THEN** `js/cli/src/data/web-adapter.json` MUST содержать запись компонента с `componentName`, `name` и шаблонами по стилю
- **THEN** записи MUST быть упорядочены по `componentName`

#### Scenario: Нет второй копии

- **WHEN** проверяются файлы, хранящиеся в Git
- **THEN** вне `js/cli/src/data` MUST NOT быть файла `web-adapter.json`

## REMOVED Requirements

### Requirement: Статический web-адаптер CLI совпадает с копией web-плагина

**Reason**: копия web-плагина удаляется, сравнивать не с чем; требования к самому файлу перенесены в «Единственный web-адаптер в CLI».

**Migration**: тест сравнения копий удаляется; шаблоны дописываются только в `js/cli/src/data/web-adapter.json`.
