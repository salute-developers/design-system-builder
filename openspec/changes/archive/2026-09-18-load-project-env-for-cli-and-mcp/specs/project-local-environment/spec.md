## ADDED Requirements

### Requirement: Проектный источник env

CLI и MCP SHALL использовать необязательный `.env` только из корня локального проекта, найденного через ближайший `.sdds/config.json`. Для каждого имени непустое значение env процесса MUST иметь приоритет над значением проектного `.env`; отсутствие файла MUST сохранять существующее поведение.

#### Scenario: Команда запущена из вложенной директории

- **WHEN** ближайшая project config расположена в `/repo/.sdds/config.json`, а starting directory равна `/repo/src`
- **THEN** runtime MUST читать `/repo/.env`
- **THEN** runtime MUST NOT читать `/repo/src/.env`

#### Scenario: Выбран ближайший вложенный проект

- **WHEN** от starting directory доступны `/repo/.sdds/config.json` и `/repo/nested/.sdds/config.json`
- **WHEN** ближайшая config находится в `/repo/nested/.sdds/config.json`
- **THEN** runtime MUST использовать только `/repo/nested/.env`

#### Scenario: Env процесса перекрывает проектный файл

- **WHEN** env процесса и проектный `.env` содержат непустые значения одного имени
- **THEN** runtime MUST выбрать значение env процесса

#### Scenario: Локальный файл отсутствует

- **WHEN** найден `.sdds/config.json`, но рядом нет `.env`
- **THEN** runtime MUST продолжить разрешение через существующие источники без ошибки

#### Scenario: Нет локального context

- **WHEN** команда не разрешила локальный `.sdds/config.json` или выбрала явный `designSystem` URI
- **THEN** runtime MUST NOT читать `.env` из starting directory или её родителей

### Requirement: Формат и обработка проектного `.env`

Runtime SHALL читать `.env` как UTF-8 данные с присваиваниями `NAME=VALUE`, пустыми строками, комментариями, необязательным `export` и одиночными либо двойными кавычками. Runtime MUST NOT выполнять shell-команды или интерполяцию. Ошибки чтения и синтаксиса MUST возвращаться без раскрытия значений.

#### Scenario: Поддерживаемый формат

- **WHEN** файл содержит комментарий, `export DSB_DEV_API_KEY='key'` и `DSBUILDER_API_URL="https://example.test"`
- **THEN** runtime MUST разрешить оба имени без кавычек и без запуска shell

#### Scenario: Повтор имени

- **WHEN** файл содержит несколько корректных присваиваний одного имени
- **THEN** последнее присваивание MUST определять значение этого имени внутри файла

#### Scenario: Некорректная строка

- **WHEN** существующий `.env` содержит некорректное присваивание или не может быть прочитан как UTF-8
- **THEN** runtime MUST вернуть ошибку конфигурации с путём и номером строки, когда он известен
- **THEN** ошибка MUST NOT содержать значение переменной или содержимое строки

#### Scenario: Секрет не покидает runtime

- **WHEN** project key прочитан из `.env`
- **THEN** CLI output и MCP results MUST NOT содержать значение key
- **THEN** runtime MUST NOT записывать key в `.sdds/config.json` или глобальное окружение процесса
