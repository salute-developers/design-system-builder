# Proposal

## Why

Web-генерации нужны маппинги «свойство общего конфига → web-токен компонента». Источник этих маппингов —
JSDoc-аннотации `@style*` над словарями токенов `plasma-new-hope`, но собрать их в машиночитаемый вид было нечем.
Кроме того, `js/cli` брал `tsx` и `typescript` из `services/generator`, хранил локальную `.sdds` в репозитории,
а выгрузка компонентов дизайн-системы `base` отказывала: у сида не было опубликованной версии.

## What Changes

- `js/cli`: скрипт `npm run generate:api-meta` строит `web-api-meta.json` по аннотациям токенов установленного пакета
  (`--package`) или исходников (`--source`). По умолчанию пишет в `<sdds>/web/web-api-meta.json`.
- `js/cli`: исходники перенесены в `src/`; `typescript`, `tsx`, `@types/node` и `@salutejs/plasma-new-hope` (`latest`)
  объявлены в devDependencies; локальная `.sdds` убрана из репозитория и игнорируется; README объединён.
- db-service: `GET /tenants/:id/token-values` отдаёт значение, привязанное к палитре, ссылкой `[type.shade.saturation]`
  или `[type.shade.saturation][opacity]`.
- db-service: сид `base` получает опубликованную версию `0.1.0`, если опубликованных версий ещё нет.
- Данные сидов: у `IconButton.paddingEnd` убран web-параметр `iconButtonPadding` (он принадлежит `paddingStart`),
  `List.listItemDividerWidth` переименован в `listItemDividerHeight` по токену ядра.
- client: `ComponentEditorPreview` считает аргументы стори без `useMemo`.
- `js/.env.example`: `NPM_PACKAGE_SCOPE`.

## Impact

- `js/cli`: `src/generate-api-meta.ts`, перенос в `src/`, `package.json`, `.gitignore`, README.
- `js/services/db-service`: `routes/api/tenants.ts`, `seeds/prod/design_systems.ts`, сиды `iconButton`, `list`.
- `js/apps/client`: `ComponentEditorPreview.tsx`.
- Спецификации: новая `style-api-meta`; дельты `design-system-model-api`, `component-seed-format`.
- Опубликованный `@salutejs/plasma-new-hope@0.383.0` содержит аннотации только у трёх компонентов; полные маппинги
  появятся с релизом plasma, в котором разметка опубликована.
