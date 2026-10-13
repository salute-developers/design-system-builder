## Why

У дизайн-системы может быть несколько тем, и `theme fetch` уже сохраняет в `.sdds` каждую из них. Но локальная web-генерация умеет положить в пакет только одну: при нескольких темах `npm run generate:theme` и `generate:ds` останавливаются с требованием `--tenant`, а `dsbuilder theme generate` для React этот параметр не передаёт и поэтому не работает вовсе. Пакет дизайн-системы должен содержать все её темы.

## What Changes

- `npm run generate:theme` и `npm run generate:ds` без `--tenant` генерируют в один `src/theme` все темы, лежащие в `.sdds/tenants`: тема — это каталог с `meta.json`. Для этого `.sdds/config.json` не нужен. У каждой темы свои файлы `themes/<имя>__dark.ts`, `themes/<имя>__light.ts` и CSS, общий индекс экспортирует все темы.
- `--tenant <name>` работает как сейчас: тема ищется по имени в `.sdds/config.json` с учётом её `directoryPath`. Дополнительно, если `config.json` нет или темы с таким именем в нём нет, `<name>` считается именем каталога в `.sdds/tenants`.
- Файл токенов `tokens/index.ts` один на пакет: имена переменных общие для всех тем, а запасные значения берутся из темы по умолчанию — первой по имени каталога либо заданной новым параметром `--default-tenant <name>`.
- Сборщик тем сервиса генерации (`js/services/generator/app/themeBuilder`) получает вход из нескольких тем; результат для одной темы не меняется, поэтому сервис генерации продолжает работать как раньше.
- Темы с совпадающим именем или с именем, которое не может быть идентификатором в коде, отклоняются до записи файлов.
- В `js/cli` появляется запуск тестов: сейчас его нет.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `local-web-generation`: генерация темы и дизайн-системы включает все темы дизайн-системы; добавляются правила выбора темы по умолчанию и проверки имён.

## Impact

- `js/cli`: `src/theme.ts`, `src/ds.ts`, `src/local-theme-source.ts`, `src/theme-source.ts`, `src/generate-theme.ts`, `README.md`, новый скрипт `test` в `package.json`.
- `js/package.json`: тесты `js/cli` подключаются к `verify:fast`.
- `js/services/generator/app/themeBuilder`: в `generate.ts` появляется `generateThemeSet`; прежняя `generate` и её вызов из `generateThemeFiles` сервиса не меняют поведения.
- `frontend-kt`: кода не касается. `WebNpmDelegate` уже вызывает `generate:theme` и `generate:ds` без `--tenant`, а `theme fetch` уже пишет все темы; команды `dsbuilder theme generate` и `dsbuilder ds generate` для React начинают работать с несколькими темами.
- `backend-kt`, `db-service`, схема базы и API: без изменений.
- Потребители пакета: у дизайн-системы с одной темой состав `src/theme` не меняется; у дизайн-системы с несколькими темами в пакете появляются дополнительные файлы и экспорты.
