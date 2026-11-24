## Context

`js/apps/preview-web-plugin` — React + Vite приложение: мост `sdds.preview.*`, разбор payload `WEB`, перевод в CSS-переменные ядра, реестр story и упаковка архива для `ds-service`. С DS Builder его связывают:

| Связь | Где | После переноса |
|---|---|---|
| Общие правила маппинга, `web-adapter.json`, мета, манифесты | npm `@sddsjs/design-system-builder-generator@0.2.0` | без изменений |
| Фикстура `web-button.json` контракта | `test/fixtures.ts` → `../../../backend-kt/preview/contract` | тест удаляется |
| Список `componentMapper` клиента | константа в `test/manifest.test.ts` | сверка удаляется |
| Архив и блок происхождения | `scripts/package.mjs` пишет `local-dev/web-preview/*.zip` и `local-dev/README.md` | архив в каталоге пакета, блок печатается |
| Комментарии со ссылками на `js/apps/client/...` | `src/**` | переформулируются без путей DS Builder |

plasma — монорепозиторий на npm workspaces и Lerna (`version: independent`, `exact: true`). Вертикали подключают ядро точной версией `0.391.0-dev.0`, равной версии `packages/plasma-new-hope`, и npm связывает её с workspace. Служебные пакеты помечены `"private": true` и Lerna их не публикует.

## Goals / Non-Goals

**Goals:**
- Плагин собирается, тестируется и упаковывается в plasma без файлов DS Builder.
- Поведение плагина и формат архива не меняются; `ds-service` и CLI публикуют архив как раньше.
- В DS Builder не остаётся исходников плагина и ссылок на `js/apps/preview-web-plugin`.

**Non-Goals:**
- Публикация плагина в npm и релизы Lerna.
- Отдельный CI-workflow плагина и автоматическая доставка архива в `local-dev` DS Builder. Общий CI plasma (`lerna run lint --since`, `lint:packages`) пакет затронет сам — к нему пакет приводится (решение 6).
- Перенос story на общую фабрику `plasma-sb-utils`.

## Decisions

### 1. Пакет `packages/sdds-preview-web-plugin`, private

Имя `@salutejs/sdds-preview-web-plugin`, `"private": true`: Lerna его не выпускает, `lint:packages` не требует публикации. Каталог — в `packages/*`, уже входящих в workspaces и `lerna.json`.

### 2. Зависимости из workspace

`@salutejs/plasma-new-hope`, `@salutejs/plasma-b2c`, `@salutejs/plasma-icons` объявляются точными текущими версиями этих пакетов в plasma — npm берёт их из workspace, как у вертикалей. Этого требует `scripts/lint-packages.js` (`lintDepsVersions`), поэтому `plasma-b2c` и `plasma-icons` меняются с опубликованных `1.634.0`/`1.238.0` на workspace-версии (`1.647.0-dev.0`/`1.259.0-dev.0`); ядро остаётся `0.391.0-dev.0`. Там же обязательно поле `author` (`Salute Frontend Team <salute.developers@gmail.com>`). Плагин рисует и строит мету тем ядром, что лежит в репозитории; перед сборкой ядро собирается (`npx lerna run prepare --scope @salutejs/sdds-preview-web-plugin --include-dependencies`), иначе у него нет `types/**/*.tokens.d.ts` для `api-meta` (генератор находит ядро подъёмом по `node_modules` до симлинка workspace).

React — 19.2.4, как в корне plasma. С React 18 плагин в workspace не работает: десятки библиотек, которыми пользуется ядро (`styled-components`, `react-popper`, `@floating-ui/react`, `react-number-format` и др.), подняты в корень рядом с React 19 и подключают его CJS-`require`; второй React в дереве ломает хуки, и ни `dedupe`, ни `alias`, ни `server.deps.inline`, ни предсборка Vitest этого не обходят. Типы — как в корне (`@types/react` 18.0.28, `@types/react-dom` 18.0.11, `@types/styled-components` 5.1.0): с типами 19 компоненты ядра несовместимы по JSX. Vitest — версия корня (4.1.12): `@testing-library/jest-dom` из корня расширяет `expect` корневого Vitest. Vite, jsdom, TypeScript — свои версии пакета, вложенными копиями.

У ядра в своих `node_modules` лежит React 18.2.0 (devDependency), и `import 'react'` из его `dist` нашёл бы эту копию. Поэтому `vite.config.ts` и `vitest.config.ts` направляют `react`, `react-dom`, `styled-components` через `resolve.alias` и `dedupe` на зависимости плагина, а Vitest пропускает пакеты `@salutejs/*` через Vite (`server.deps.inline`). Проверка — тесты рендера и отсутствие второй версии React в бандле.

Путь к установленному ядру в тестах (`node_modules/@salutejs/plasma-new-hope/package.json` от `process.cwd()`) в workspace не работает: ядро поднято в корень. Тесты и упаковка находят его через `createRequire` (`require.resolve('@salutejs/plasma-new-hope/package.json')`).

`@sddsjs/design-system-builder-generator` — `0.2.0` из npm, как сейчас.

### 3. Упаковка без файлов DS Builder

`scripts/package.mjs` сохраняет проверки и состав архива, но:
- пишет `archive/preview-web-plugin.zip` в каталоге пакета (в `.gitignore`);
- проверяет незакоммиченные изменения в каталоге пакета и в пакетах workspace, которые попадают в бандл (`packages/plasma-new-hope`, `packages/plasma-b2c`, `packages/plasma-icons`); `commit` — коммит plasma;
- дописывает в манифест сборки `plasmaNewHopeVersion` из установленного ядра, как уже дописывает `apiMetaSha256`: поле убирается из закоммиченного `public/preview-plugin.json`, иначе каждый выпуск ядра Lerna-ом ломал бы тест совпадения версии (клиент DS Builder это поле не проверяет);
- печатает блок происхождения (`commit`, `version`, `plasmaNewHopeVersion`, sha256 архива и меты) вместо правки `local-dev/README.md`.

Обновление стенда DS Builder: скопировать архив в `local-dev/web-preview/preview-web-plugin.zip` и вставить блок в `local-dev/README.md`. Публикация на стенды — `dsbuilder preview-plugin publish --platform react --from <архив>`, как раньше.

### 4. Тесты без контракта DS Builder

Удаляются тест «фикстура контракта разбирается» в `test/payload.test.ts`, функция `readContractWebButtonFixture` и сверка реестра с `CLIENT_COMPONENT_MAPPER` в `test/manifest.test.ts`. Копий контракта и списка клиента нет: их пришлось бы синхронизировать. Разбор payload покрывают собственные фикстуры плагина (`webButtonPayload`), совпадение манифеста и реестра — оставшиеся тесты манифеста.

Цена: несовместимость формата payload между клиентом DS Builder и плагином тесты не ловят; она видна при ручной проверке превью. Контракт остаётся в `backend-kt/preview/contract` и проверяется тестами клиента и Compose.

### 5. Удаление из DS Builder

Каталог `js/apps/preview-web-plugin` удаляется. Документы и скрипты ссылаются на `packages/sdds-preview-web-plugin` репозитория plasma. Правило `AGENTS.md` о подъёме версии плагина снимается: версионирование в plasma автоматизировано и пакет приватный. `local-dev/web-preview/preview-web-plugin.zip` и его блок происхождения в `local-dev/README.md` остаются как есть.

### 6. Линтер plasma

Пакет проверяется корневым eslint plasma (`.eslintrc.js`, `@salutejs/eslint-config`, Prettier 2.0.5): скрипт `lint` — как у пакетов plasma (`eslint ./src --ext .js,.ts,.tsx --quiet`), свой flat-конфиг DS Builder не переносится. Поведение не меняется:
- `react/react-in-jsx-scope` выключен в `.eslintrc.cjs` пакета: плагин собирается с новым JSX-runtime;
- импорты `import { x, type Y }` разнесены на `import { x }` и `import type { Y }` — Prettier 2.0.5 их не разбирает;
- длинные однострочные `if` получают фигурные скобки (иначе спорят `prettier` и `curly`), стрелочные функции в JSX-атрибутах — тело в скобках (иначе спорят `prettier` и `react/jsx-curly-newline`);
- `no-continue` и `no-nested-ternary` — `eslint-disable-next-line`, как в ядре plasma; длинные комментарии перенесены.

## Risks / Trade-offs

- [Плагин и DS Builder расходятся в формате payload без автоматической проверки] → ручная проверка превью после изменений протокола; при частых изменениях — отдельная задача на контрактные тесты.
- [Ядро в plasma новее опубликованного, стенд получает плагин с неопубликованным ядром] → `plasmaNewHopeVersion` в манифесте показывает версию; архив для стенда собирается с осознанно выбранного коммита plasma.
- [Сборка плагина требует собранного ядра] → команда подготовки в README пакета.
- [Генератор 0.2.0 (`web-adapter.json`, манифесты) рассчитан на ядро `0.391.0-dev.0`, а плагин рисует ядро из HEAD plasma] → при расхождении правил маппинга с новым ядром выпускается новая версия генератора; версия ядра видна в манифесте архива.
- [Смена `plasma-b2c`/`plasma-icons` на workspace-версии] → проверка рендера всех story тестами и вручную на стенде.

## Migration Plan

1. Пакет в plasma: перенос, зависимости, упаковка, тесты; `npm test` и `npm run build` в пакете.
2. Удаление каталога в DS Builder и правка ссылок; `cd js && npm run build`.
3. Коммиты и PR — пользователь, в двух репозиториях.

Откат — вернуть каталог в DS Builder из Git; пакет в plasma не используется ничем, кроме ручной упаковки.
