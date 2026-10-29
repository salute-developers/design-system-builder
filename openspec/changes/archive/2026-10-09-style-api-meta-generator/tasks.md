# Tasks

Изменение оформлено ретроспективно: реализация уже в ветке `PLASMABLDR-186`.

## 1. Генератор маппингов

- [x] 1.1 `src/generate-api-meta.ts`: `--package` (установленный пакет, `types/**/*.tokens.d.ts`) и `--source` (исходники).
- [x] 1.2 Словарь — экспорт `tokens` или единственный `*Tokens`; `privateTokens`/`innerTokens`, `_beta` и `Tour/components/Card` не читаются; словарь без аннотаций пропускается.
- [x] 1.3 Теги `@styleType`, `@styleProp`, `@stylePart`, `@styleState`, `@styleComponent`, `@deprecated {@link …}`; отказ при токене без `@styleType` и при неуникальном имени компонента.
- [x] 1.4 Результат по умолчанию — `<sdds>/web/web-api-meta.json`; `--out`, `--sdds`; детерминированный порядок.

## 2. js/cli

- [x] 2.1 Исходники в `src/`, зависимости в devDependencies, `@salutejs/plasma-new-hope: latest`.
- [x] 2.2 `.sdds` убрана из репозитория и добавлена в `.gitignore`; README объединён.

## 3. db-service и данные

- [x] 3.1 `GET /tenants/:id/token-values`: ссылки на палитру строкой.
- [x] 3.2 Сид `base`: опубликованная версия `0.1.0` в пустую историю.
- [x] 3.3 Сиды `iconButton`, `list`.

## 4. Проверка

- [x] 4.1 `tsc` в `js/cli` и db-service; тесты db-service (79) после ребейза на `dev`.
- [x] 4.2 `generate:api-meta` по локальной сборке plasma 0.383.0 — 64 компонента; по опубликованной 0.383.0 — 3.
