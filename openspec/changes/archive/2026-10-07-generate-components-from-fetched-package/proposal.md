# Proposal

## Why

Локальная генерация пакета компонентов (`js/cli`, `npm run generate:components`) читала
`.sdds/component-configs.json` — ответ legacy-ручки `component-configs` с UUID и web-маппингами
из базы. Выгрузка `component-config/export`, по которой `dsbuilder components fetch` пишет папку
`components/`, несёт значения, но не несёт того, без чего генератор не соберёт пакет: шаблонов
web-параметров (`0 $1`), compose-связей компонентов и числовых смещений из поправок платформенных
параметров. Имена web-параметров теперь даёт `web-api-meta.json` из аннотаций токенов
(`generate:api-meta`), но шаблоны зависят от дизайн-системы и остаются в базе.

## What Changes

- Новая временная ручка `POST /ds/component-config/web-meta` (`designSystemId` в теле) отдаёт
  `template` (шаблоны web-параметров по конфигурациям: свойство → параметр → шаблон) и
  `dependencies.compose` (родитель → дочерние компоненты пакета). В ответ `/export` эти данные
  не входят: формат конфигураций общий для платформ, и web-костыль его не расширяет.
- Смещение значения (`adjustment`) в `/export` берётся из колонки строки, а если она пуста — из
  числовых поправок платформенных параметров с приоритетом web, как в legacy-выгрузке. Раньше
  смещение `shape` кнопки (`round.l`, `-2`) терялось.
- `components fetch` для платформы React (`--platform`, иначе единственная платформа project config,
  как у `components generate`) по образцу legacy-снимка загружает ответ `web-meta` до записи
  пакета и сохраняет его как есть в `.sdds/web/meta-template.json` и `.sdds/web/meta-dependencies.json`.
  Для других платформ или невыбранной платформы запрос не выполняется, fetch не отказывает.
  Модель пакета, план записи, формат `meta.json` и конфигов не меняются; push эти файлы не читает.
- `js/cli` собирает модель генератора только по локальным данным: `.sdds/components` и
  `.sdds/web` (`meta-template.json`, `meta-dependencies.json`, `web-api-meta.json`);
  `component-configs.json` генерацией не используется. Описание компонента не выгружается — отдельным изменением.
- `generate:api-meta` без `--out` пишет `.sdds/web/web-api-meta.json`.
- Данные: у `IconButton.paddingEnd` убран web-параметр `iconButtonPadding` (он принадлежит
  `paddingStart`), `List.listItemDividerWidth` переименован в `listItemDividerHeight` по токену ядра.

Удалить временное решение — значит удалить ручку `web-meta`, модуль `db/export/webGenerationMeta.ts`,
порты `WebGenerationMeta*` и их адаптеры в `feature-components`.

## Impact

- `js/services/db-service`: `db/export/componentExport.ts`, `db/export/webGenerationMeta.ts`,
  роут `component-config-web-meta.ts`, OpenAPI, сиды `iconButton`, `list`.
- `frontend-kt/feature-components`: `WebGenerationMetaPorts.kt`, `WebGenerationMetaAdapters.kt`,
  `FetchComponentsUseCase`, DI; `frontend-kt/cli`: опция `--platform` у `components fetch`, `USAGE.md`.
- `js/cli`: `src/component-source.ts`, `src/components.ts`, `src/generate-api-meta.ts`, README.
- Спецификации: `cli-components` (fetch, ручки), новая `local-web-generation`.
