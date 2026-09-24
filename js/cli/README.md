# Локальная генерация

Генерация компонентов и тем использует `../services/generator`.
CLI читает локальные данные, раскрывает ссылки на палитру из `.sdds` и передаёт тему
исходной функции `generate` сервиса. Сервис и его API не изменяются.
Структура результата (`themes`, `css`, `tokens`) сохраняется; содержимое файлов
определяется исходным генератором и может отличаться от удалённого `cli/theme-builder`
в обработке отсутствующих значений, старых токенов Plasma и форматировании.
Нужны установленные зависимости этого сервиса (`npm ci` в `js/services/generator`).

Из `js/cli`:

```sh
npm run generate:components
```

Для отдельной генерации темы:

```sh
npm run generate:theme
npm run generate:theme -- --sdds ./.sdds --tenant qwe_default
```

Команда сохраняет тему в `js/cli/output/theme`, а исходные модули `meta.js` и
`variations.js` — в `js/cli/output`. Файл `component-configs.json` ей не нужен.
Tenant выбирается из `config.json` по тем же правилам, что и для компонентов.
Справка: `npm run generate:theme -- --help`.

Входные данные:

- `.sdds/component-configs.json` — массив метаданных компонентов в формате генератора (`name`, `description`, `deps`, `sources.api`, `sources.variations`, `sources.configs`), включая web-маппинги.
- `.sdds/config.json` — список tenants, пути к теме (`directoryPath`) и палитре (`palettePath`).
- `.sdds/tenants/<tenant>/meta.json` и `web/*.json` — тема.
- `.sdds/tenants/palette.json` — палитра.

Можно указать другой каталог `.sdds`, tenant, имя и версию пакета:

```sh
npm run generate:components -- --sdds ../../cli/.sdds --tenant plasma_homeds_default --ds-name my-ds --ds-version 0.1.0
```

По умолчанию выбирается единственный tenant из `.sdds/config.json`.
Если их несколько, нужно указать `--tenant`. Имя пакета берётся из метаданных темы,
версия — `0.1.0`. `--core-version` задаёт версию `@salutejs/plasma-new-hope`.

Исходники пакета, тема и конфигурация сборки сохраняются рядом в
`js/cli/output/components`; этот каталог перезаписывается при следующем запуске.
CLI не обращается к бэкенду, не устанавливает зависимости сгенерированного пакета
и не публикует его. Для компиляции можно отдельно запустить команды сборки пакета.
Файлы `components/*_config.json` без API и web-маппингов не заменяют `component-configs.json`.
