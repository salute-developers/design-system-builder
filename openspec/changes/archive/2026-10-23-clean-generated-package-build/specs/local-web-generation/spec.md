## ADDED Requirements

### Requirement: Сборка пакета не меняет исходники

Сборка пакета, сгенерированного с `--package`, SHALL NOT запускать eslint и SHALL NOT изменять `src`.
Заготовка пакета SHALL NOT содержать конфигов eslint, а `package.json` пакета — скрипта `lint`.

#### Scenario: Сборка вне репозитория

- **WHEN** пакет из одной темы сгенерирован с `--package` в каталог вне `js/cli` и в нём выполнены `npm install` и `npm pack`
- **THEN** сборка MUST завершиться успешно без eslint в `PATH`
- **THEN** содержимое `src` после сборки MUST совпадать с содержимым до неё

#### Scenario: Очистка после npm pack

- **WHEN** папка пакета лежит в git-репозитории, сама не игнорируется, и в ней выполнен `npm pack`
- **THEN** скрипт `postpack` MUST удалить игнорируемые файлы папки, кроме `.tgz`
- **THEN** отслеживаемые файлы и `src/theme` MUST остаться
- **WHEN** папка не в git-репозитории или игнорируется
- **THEN** `postpack` MUST ничего не удалять и MUST завершиться с кодом 0

#### Scenario: Состав заготовки

- **WHEN** CLI пишет папку пакета
- **THEN** в ней MUST NOT быть `eslint.config.mjs` и `.eslintrc.js`
- **THEN** `package.json` MUST NOT содержать скрипт `lint`, а скрипт `build` MUST NOT вызывать `npm run lint`
