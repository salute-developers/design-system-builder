## ADDED Requirements

### Requirement: Архивы плагина в GitHub Release

Репозиторий SHALL выпускать плагин DS Builder Tokens архивами в GitHub Release по тегу `tokens-plugin-vX.Y.Z`. Релиз MUST содержать архив для Figma, архив для Pixso и файл контрольных сумм SHA-256. Релиз MUST NOT помечаться как Latest.

#### Scenario: Выпуск по тегу

- **WHEN** в репозиторий отправлен тег `tokens-plugin-v0.1.0`
- **THEN** workflow MUST собрать плагин, выполнить тесты и создать релиз с архивами `ds-builder-tokens-figma-0.1.0.zip` и `ds-builder-tokens-pixso-0.1.0.zip`
- **THEN** релиз MUST NOT стать Latest

#### Scenario: Тег не совпадает с версией

- **WHEN** версия в теге отличается от версии в `package.json` плагина
- **THEN** workflow MUST завершиться ошибкой без создания релиза

#### Scenario: Повторный запуск

- **WHEN** workflow запущен вручную на теге существующего релиза
- **THEN** workflow MUST заменить архивы и контрольные суммы этого релиза

### Requirement: Состав архивов

Архив Figma SHALL содержать `manifest.json`, `dist/code.js`, `dist/ui.html` и `README.txt` с установкой через импорт манифеста. Архив Pixso SHALL содержать `manifest.json`, `code.js`, `ui.html` и `README.txt`. Манифест MUST указывать на файлы своего архива.

#### Scenario: Манифест указывает на отсутствующий файл

- **WHEN** `main` или `ui` манифеста не входит в состав архива
- **THEN** упаковка MUST завершиться ошибкой

### Requirement: Gateway сборок релиза

Окно архива Figma SHALL обращаться к боевому gateway, который разрешает `networkAccess` манифеста. Окно архива Pixso SHALL обращаться к шлюзу Yandex Cloud перед боевым gateway. Окно MUST NOT содержать gateway другого редактора и адреса разработки `http://localhost:8080` и `https://gateway-dev.design-system-builder.ru`.

#### Scenario: Окно собрано не для своего редактора

- **WHEN** окно архива Pixso обращается к боевому gateway вместо шлюза Yandex Cloud
- **THEN** упаковка MUST завершиться ошибкой
