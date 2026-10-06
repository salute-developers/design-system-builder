# Локальная генерация

Генерация компонентов и тем использует `../services/generator`.
CLI читает локальные данные, раскрывает ссылки на палитру из `.sdds` и передаёт тему
исходной функции `generate` сервиса. Сервис и его API не изменяются.
Структура результата (`themes`, `css`, `tokens`) сохраняется; содержимое файлов
определяется исходным генератором и может отличаться от удалённого `cli/theme-builder`
в обработке отсутствующих значений, старых токенов Plasma и форматировании.
Нужны установленные зависимости этого сервиса (`npm ci` в `js/services/generator`)
и самого CLI (`npm ci` в `js/cli`).

Из `js/cli`:

```sh
dsbuilder components fetch --platform react
npm run generate:api-meta -- --package @salutejs/plasma-new-hope
npm run generate:components
```

Для отдельной генерации темы:

```sh
npm run generate:theme
npm run generate:theme -- --sdds ./.sdds --tenant qwe_default
```

Команда сохраняет тему в `js/cli/output/theme`, а исходные модули `meta.js` и
`variations.js` — в `js/cli/output`. Выгрузка компонентов ей не нужна.
Tenant выбирается из `config.json` по тем же правилам, что и для компонентов.
Справка: `npm run generate:theme -- --help`.

Входные данные:

- `.sdds/components/` — выгрузка `dsbuilder components fetch`: `meta.json` (состав пакета) и
  `<component>_<style>_config.json` (значения).
- `.sdds/web/web-adapter.json` — временный файл из базы, массив записей по `componentName`: имена и описания компонентов, дочерние
  компоненты `compose` (по ним раскладываются папки пакета) и шаблоны web-параметров по стилям
  (свойство → параметр → шаблон вроде `0 $1`). Пишет `dsbuilder components fetch` для платформы
  React (`--platform react` или `"platforms": ["react"]` в `config.json`).
- `.sdds/web/web-api-meta.json` — web-параметры свойств из аннотаций токенов, собирается
  `generate:api-meta` из установленной версии пакета компонентов (см. ниже).
- `.sdds/config.json` — список tenants, пути к теме (`directoryPath`) и палитре (`palettePath`).
- `.sdds/tenants/<tenant>/meta.json` и `web/*.json` — тема.
- `.sdds/tenants/palette.json` — палитра.

CLI собирает из них прежнюю модель генератора: свойство — ключ в конфиге, его web-параметры —
записи `web-api-meta.json` с тем же `id` без `state` (имена состояний генератор выводит сам),
шаблон, имя и описание компонента — из `web-adapter.json`. Тип свойства берётся из выгрузки, а не из аннотации:
аннотация описывает CSS-значение целиком (`itemPadding: 0 8px` — `value`), а выгрузка — то, что
лежит в модели (`dimension`, раскладываемый шаблоном `0 $1`).

Можно указать другой каталог `.sdds`, каталог выгрузки (`--components`), каталог web-данных
(`--web`), tenant, имя и версию пакета:

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
`component-configs.json` генерацией не используется.

# Метаданные Style API

`npm run generate:api-meta` строит машиночитаемый `api-meta.json` по JSDoc-аннотациям CSS-токенов
React-компонентов. Метаданные связывают внутренние токены компонента со свойствами общего конфига,
не меняя runtime компонента, и нужны генераторам конфигов и другим инструментам дизайн-системы.

## Как это работает

1. Компонент экспортирует объект `tokens` из `*.tokens.ts`.
2. Над каждым токеном пишется JSDoc-комментарий с тегами Style API.
3. При сборке компонентов аннотации вырезаются из JS-файлов и остаются только в `.d.ts`, которые публикуются вместе с пакетом.
4. Генератор разбирает `*.tokens.d.ts` установленного пакета (или `*.tokens.ts` исходников) через TypeScript Compiler API, проверяет аннотации и собирает `api-meta.json`.

```ts
export const tokens = {
    /** @styleType color */
    buttonColor: '--plasma-button-color',
    /** @styleType color @styleProp buttonColor @styleState hovered */
    buttonColorHover: '--plasma-button-color-hover',
    /** @styleType color @deprecated {@link buttonColor} */
    buttonTextColor: '--plasma-button-text-color',
    /** @styleType typography @styleProp buttonLabelStyle @stylePart fontFamily */
    buttonFontFamily: '--plasma-button-font-family',
};
```

## Теги

| Тег | Обязателен | Значение |
| --- | --- | --- |
| `@styleType <type>` | да | Тип свойства, см. ниже. |
| `@styleProp <id>` | нет | `id` свойства общего конфига. По умолчанию совпадает с ключом токена (1 к 1). |
| `@stylePart <part>` | для `typography` и `component_style` | Часть составного свойства. Для `typography`: `fontFamily`, `fontSize`, `fontStyle`, `fontWeight`, `letterSpacing`, `lineHeight`. |
| `@styleState <state>` | нет | Состояние, к которому относится токен. У свойства должен быть токен без состояния. |
| `@styleComponent <A> [<B> ...]` | нет | Компоненты, к которым относится токен, через пробел, — если один словарь обслуживает несколько компонентов. По умолчанию — компонент файла. |
| `@deprecated {@link <token>}` | нет | Токен устарел, замена — указанный токен. Стандартный тег: редакторы зачёркивают использования токена. |

Поддерживаемые типы: `value`, `boolean`, `integer`, `float`, `dimension`, `color`, `typography`,
`shape`, `shadow`, `icon`, `component_style`.

Аннотации преобразуются в параметры metadata:

```json
[
  { "paramName": "buttonColor", "type": "color", "id": "buttonColor" },
  { "paramName": "buttonColorHover", "type": "color", "id": "buttonColor", "state": "hovered" },
  { "paramName": "buttonTextColor", "type": "color", "id": "buttonTextColor", "deprecated": { "message": "Используйте вместо buttonColor" } },
  { "paramName": "buttonFontFamily", "type": "typography", "id": "buttonLabelStyle", "part": "fontFamily" }
]
```

## Генерация

Пакет компонентов ставится в devDependencies `js/cli`, затем из `js/cli`:

```sh
npm run generate:api-meta -- --package @salutejs/plasma-new-hope
npm run generate:api-meta -- --package @salutejs/plasma-new-hope --out ./api-meta.json
npm run generate:api-meta -- --source ../../../plasma/packages/plasma-new-hope/src --out ./api-meta.json
```

| Опция | Значение |
| --- | --- |
| `--package <name>` | Установленный пакет, из которого читаются `.d.ts`. |
| `--source <dir>` | Папка с `*.tokens.ts` или `*.tokens.d.ts`, например исходники в монорепозитории. |
| `--out <file>` | Куда записать метаданные. По умолчанию `<sdds>/web/web-api-meta.json`, где их читает генерация компонентов. |
| `--sdds <dir>` | Каталог `.sdds` для пути по умолчанию (по умолчанию `js/cli/.sdds`). |

Генератор находит пакет в `node_modules` текущей папки или её родителей и читает
`types/**/*.tokens.d.ts`. Метаданные соответствуют установленной версии пакета; имя и версия
выводятся в консоль, но в файл не записываются:

```json
[{ "componentName": "Button", "params": [] }]
```

Генерировать можно только из версий пакета, опубликованных с аннотациями. Компоненты и параметры
сортируются, поэтому повторный запуск по тем же исходникам создаёт идентичный файл.

## Какие файлы и словари читаются

- Файлы `*.tokens.ts`, `*.tokens.d.ts`, а также `tokens.ts` и `tokens.d.ts`. Компонент по умолчанию — имя файла без суффикса (`Button.tokens.ts` → Button) или имя папки для `tokens.ts` (`Skeleton/tokens.ts` → Skeleton).
- Токен с `@styleComponent` попадает во все перечисленные компоненты: так один словарь описывает несколько компонентов (`Tabs/tokens.ts` → Tabs, TabItem, IconTabItem).
- Словарь — экспорт `tokens`, а если его нет, единственный экспорт с именем `*Tokens` (например, `treeTokens` в `Tree`, `tableTokens` в `Table`). Внутренние `privateTokens` и `innerTokens` не читаются.
- Файл без словаря (например, только с `classes`) даёт компонент с пустым `params`.
- Словарь без единой аннотации считается ещё не размеченным и пропускается.
- Папки `_beta` и `Tour/components/Card` не читаются.

## Проверки

Полная проверка аннотаций выполняется при сборке пакета компонентов: в `plasma-new-hope` это
`scripts/checkAnnotations.mjs` в `postbuild`. Поэтому в опубликованные `.d.ts` попадает только
корректная разметка.

Генератор проверяет лишь то, без чего нельзя построить метаданные:

- в размеченном словаре у каждого токена есть `@styleType`;
- имена компонентов уникальны, иначе генератор завершается ошибкой со списком файлов.

## Аннотации в сборке

В `plasma-new-hope` скрипт `scripts/stripAnnotations.mjs` удаляет комментарии с тегами `@style*`
из `*.tokens.js` после сборки каждого движка (`postbuild:css`, `postbuild:styled-components`,
`postbuild:emotion`). Остальные комментарии, включая `#__PURE__`, не затрагиваются, а `.d.ts`
сохраняют аннотации для подсказок в редакторе.

## Возможные улучшения

- Формализовать набор состояний и при необходимости поддержать комбинации состояний.
- Уточнить семантику `component_style`, если появится необходимость ссылаться на Style API другого компонента.
- Добавить версию формата и JSON Schema для `api-meta.json`.
