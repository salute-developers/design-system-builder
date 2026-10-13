## ADDED Requirements

### Requirement: Local web generation includes every theme

`npm run generate:theme` и `npm run generate:ds` SHALL генерировать в `src/theme` все темы из `.sdds/tenants`,
когда параметр `--tenant` не задан. Темой SHALL считаться каталог в `.sdds/tenants`, содержащий `meta.json`;
`.sdds/config.json` для генерации всех тем SHALL NOT требоваться.

#### Scenario: Несколько тем в одном пакете

- **WHEN** в `.sdds/tenants` лежат каталоги тем `brand_light` и `brand_night` и разработчик запускает `generate:theme` без `--tenant`
- **THEN** CLI MUST записать для каждой темы `themes/<имя>__dark.ts`, `themes/<имя>__light.ts`, `css/<имя>__dark.css`, `css/<имя>__light.css` и `css/<имя>.module.css`
- **THEN** `themes/index.ts` MUST экспортировать тёмный и светлый вариант каждой темы
- **THEN** порядок экспортов MUST совпадать с порядком имён каталогов тем по возрастанию

#### Scenario: Одна тема

- **WHEN** в `.sdds/tenants` один каталог темы
- **THEN** содержимое `src/theme` MUST быть таким же, как до изменения

#### Scenario: Каталог без данных темы

- **WHEN** в `.sdds/tenants` есть каталог без `meta.json`, например оставшийся от удалённой темы, скрытый каталог или файл `palette.json`
- **THEN** CLI MUST пропустить его и MUST NOT считать темой

#### Scenario: Без config.json

- **WHEN** в `.sdds` нет `config.json`, но есть каталоги тем и `tenants/palette.json`
- **THEN** генерация темы MUST завершиться успешно

#### Scenario: Тем нет

- **WHEN** в `.sdds/tenants` нет ни одного каталога с `meta.json`
- **THEN** CLI MUST завершиться ошибкой с путём к каталогу и MUST NOT изменять каталог результата

#### Scenario: Ограничение одной темой

- **WHEN** разработчик передаёт `--tenant <name>` и в `.sdds/config.json` есть тема с таким именем
- **THEN** CLI MUST сгенерировать только эту тему из каталога, указанного в её `directoryPath`, как до изменения
- **WHEN** `config.json` отсутствует или темы с таким именем в нём нет
- **THEN** CLI MUST сгенерировать только тему из каталога `.sdds/tenants/<name>`
- **THEN** имя, не найденное ни в `config.json`, ни среди каталогов, MUST приводить к ошибке до записи файлов

#### Scenario: Расположение палитры

- **WHEN** в `.sdds/config.json` задан `palettePath`
- **THEN** CLI MUST читать палитру по этому пути в обоих режимах, как до изменения
- **WHEN** `config.json` отсутствует или `palettePath` в нём не задан
- **THEN** CLI MUST читать палитру из `.sdds/tenants/palette.json`

#### Scenario: Дизайн-система целиком

- **WHEN** разработчик запускает `generate:ds` без `--tenant`
- **THEN** результат в `src/theme` MUST совпадать с результатом `generate:theme` для тех же данных

#### Scenario: Пакет с несколькими темами

- **WHEN** разработчик запускает `generate:theme` или `generate:ds` с `--package` для нескольких тем
- **THEN** собранный пакет MUST содержать CSS и экспорты каждой темы

### Requirement: Default theme for token fallbacks

Файл `tokens/index.ts` SHALL быть один на пакет; запасные значения переменных в нём SHALL браться из темы
по умолчанию.

#### Scenario: Тема по умолчанию не задана

- **WHEN** параметр `--default-tenant` не передан
- **THEN** темой по умолчанию MUST быть первая из генерируемых тем по имени каталога

#### Scenario: Тема по умолчанию задана

- **WHEN** разработчик передаёт `--default-tenant <name>`
- **THEN** запасные значения в `tokens/index.ts` MUST браться из темы `<name>`, найденной по тем же правилам, что и для `--tenant`
- **THEN** имя, которого нет среди генерируемых тем, MUST приводить к ошибке до записи файлов

#### Scenario: Повторная генерация

- **WHEN** разработчик повторяет генерацию без изменения `.sdds`
- **THEN** содержимое `src/theme` MUST совпадать с предыдущим

### Requirement: Theme names are validated before generation

CLI SHALL проверять имена тем из их `meta.json` до записи файлов.

#### Scenario: Совпадающие имена

- **WHEN** у двух генерируемых тем одинаковое имя в `meta.json`, в том числе с точностью до регистра букв
- **THEN** CLI MUST завершиться ошибкой с именем темы и MUST NOT изменять каталог результата

#### Scenario: Имя не подходит для кода

- **WHEN** имя темы не является допустимым идентификатором JavaScript
- **THEN** CLI MUST завершиться ошибкой с именем темы и MUST NOT изменять каталог результата

#### Scenario: Нет данных темы

- **WHEN** у каталога темы нет web-значений или файла цветов
- **THEN** CLI MUST завершиться ошибкой с именем темы и MUST NOT изменять каталог результата

#### Scenario: Нет палитры

- **WHEN** общей палитры нет
- **THEN** CLI MUST завершиться ошибкой с путём к палитре и MUST NOT изменять каталог результата
