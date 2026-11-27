## ADDED Requirements

### Requirement: Источники документации дизайна

CLI `dsbuilder docs generate --platform design` SHALL собирать дерево документации из общего слоя и слоя вертикали
и MUST находить их по положению рабочей директории, если они не заданы опциями.

#### Scenario: Источники найдены по раскладке репозитория

- **WHEN** разработчик запускает `dsbuilder docs generate --platform design --artifact-version 1.0.0` в папке
  `verticals/<вертикаль>` репозитория документации дизайна
- **THEN** CLI MUST взять общий слой из ближайшего каталога-предка `core/`, содержащего `structure.json`
- **THEN** CLI MUST взять слой вертикали из `docs/` рабочей директории

#### Scenario: Источники заданы явно

- **WHEN** переданы `--design-core <dir>` и `--design-layer <dir>`
- **THEN** CLI MUST использовать эти каталоги и MUST NOT искать источники по раскладке

#### Scenario: Слой вертикали отсутствует

- **WHEN** у вертикали нет каталога `docs/` и `--design-layer` не задан
- **THEN** CLI MUST собрать пакет из одного общего слоя без пользовательской структуры

#### Scenario: Общий слой не найден

- **WHEN** ни у одного каталога-предка нет `core/structure.json` и `--design-core` не задан
- **THEN** CLI MUST завершиться ошибкой, называющей `core/structure.json` и опцию `--design-core`
- **THEN** CLI MUST NOT писать дерево, `docs.json`, `manifest.json` и архив

### Requirement: Версия публикации документации дизайна

CLI SHALL требовать `--artifact-version` для платформы `design` и MUST записывать её в `meta/platform-context.json`
как версию пакета.

#### Scenario: Версия передана

- **WHEN** разработчик собирает документацию дизайна с `--artifact-version 1.2.0`
- **THEN** `meta/platform-context.json` MUST содержать `platform` `design`, `artifact.id` `sdds-design-docs` и
  `artifact.version` `1.2.0`
- **THEN** `manifest.json` MUST содержать версию дизайн-системы `1.2.0` и идентификатор дизайн-системы из
  `.sdds/config.json` рабочей директории

#### Scenario: Версия не передана

- **WHEN** разработчик собирает документацию дизайна без `--artifact-version`
- **THEN** CLI MUST завершиться ошибкой, называющей `--artifact-version`, до записи дерева

#### Scenario: Опции дизайна с другой платформой

- **WHEN** `--design-core`, `--design-layer` или `--artifact-version` переданы с платформой, отличной от `design`
- **THEN** CLI MUST завершиться ошибкой, называющей опцию и платформу `design`

### Requirement: Раскладка дерева документации дизайна

CLI SHALL раскладывать слои в дерево `.sdds/temp/docs` того же формата, что дерево платформенных агрегаторов, и MUST
собирать пакет из этого дерева существующим слиянием.

#### Scenario: Дерево собрано из двух слоёв

- **WHEN** общий слой и слой вертикали найдены
- **THEN** CLI MUST очистить `.sdds/temp/docs` перед раскладкой
- **THEN** CLI MUST записать `structure-core.json` и `structure-user.json` из `structure.json` слоёв
- **THEN** CLI MUST скопировать markdown каждой страницы структуры в `content/core/<path>` или `content/user/<path>`
- **THEN** CLI MUST скопировать содержимое `assets/` слоёв в `assets/core/` и `assets/user/`
- **THEN** CLI MUST сообщить, что дерево собрал toolchain `dsbuilder-design`

#### Scenario: Слияние вертикали с общим слоем

- **WHEN** страница слоя вертикали совпадает по `path` со страницей общего слоя и задаёт `merge` `append`, `prepend`
  или `replace`, либо узел задаёт `hidden: true`
- **THEN** `docs.json` MUST отражать это правило так же, как для платформ с инструментом

#### Scenario: Страница структуры не найдена

- **WHEN** `structure.json` слоя указывает `path`, для которого в слое нет файла
- **THEN** CLI MUST завершиться ошибкой с именем слоя и `path`
- **THEN** CLI MUST NOT писать `docs.json`, `manifest.json` и архив

#### Scenario: Готовое дерево не пересобирается

- **WHEN** разработчик передаёт `--docs-dir <dir>` или `--no-aggregate` вместе с `--platform design`
- **THEN** CLI MUST NOT выполнять агрегацию дизайна и MUST NOT требовать `--artifact-version`

### Requirement: Локальные ссылки markdown документации дизайна

CLI SHALL переписывать локальные ссылки markdown под расположение файлов в архиве и MUST отклонять ссылки, которые
нельзя разрешить внутри слоя.

#### Scenario: Картинка слоя

- **WHEN** страница `components/button/overview.md` общего слоя содержит `![](../../assets/anatomy.png)`, и файл
  `core/assets/anatomy.png` существует
- **THEN** в `content/core/components/button/overview.md` ссылка MUST указывать на `assets/core/anatomy.png`
  относительным путём от этой страницы

#### Scenario: Ссылка на страницу своего слоя

- **WHEN** страница ссылается относительным путём на markdown своего слоя, который есть в структуре слоя
- **THEN** CLI MUST оставить ссылку без изменений

#### Scenario: Внешние ссылки и код не меняются

- **WHEN** markdown содержит ссылки `http`, `https`, `mailto:`, якоря `#…` либо ссылку внутри fenced-блока или
  `code span`
- **THEN** CLI MUST перенести их без изменений

#### Scenario: Ссылка за пределы слоя или на отсутствующий файл

- **WHEN** локальная ссылка абсолютная, выходит за каталог своего слоя или ведёт на отсутствующий файл
- **THEN** CLI MUST завершиться ошибкой с путём страницы и текстом ссылки
- **THEN** CLI MUST NOT писать `docs.json`, `manifest.json` и архив
