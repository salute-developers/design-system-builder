## 1. Типы сида

- [x] 1.1 В `component-seed.ts` сузить `PropertyPlatform` до `'web'`, сделать `params.web` обязательным у `PropertySeed`, оставить `AdjustSeed.platform` только `'web'`
- [x] 1.2 Удалить фильтр `ownPlatform` и связанные с ним ветки сидера, если после сужения они ничего не делают

## 2. Данные

- [x] 2.1 Удалить `xml`, `compose`, `ios` из `params` в `components/*/properties.ts`
- [x] 2.2 Удалить 22 свойства без `web` и их значения, инварианты и сочетания в `values.ts`
- [x] 2.3 Удалить нативные `adjust` (66 записей)
- [x] 2.4 Проверить, что `component-seed-writer.ts` и `import-plasma-component.ts` не пишут нативные платформы

## 2a. Снимок ds-service

- [x] 2a.1 Удалить ссылки на 22 свойства из `backend-kt/ds-service/feature-components/src/main/resources/component-seeds.json`
- [x] 2a.2 Обновить хэш в `ComponentSeedsResourceTest` и добавить проверку отсутствия удалённых свойств
- [x] 2a.3 Тесты ds-service: `ComponentSeedsResourceTest` 3/3; `:app:test` 45/46 — `WebGenerationPostgresIntegrationTest` падает и без этого change (фикстура вставляет `Tabs` без `platform`)

## 3. Проверка

- [x] 3.1 `npm run build` и `npm test` в `js/services/db-service`
- [x] 3.2 Сид на чистой базе: 63 компонента, 1505 свойств (было 1527), 0 свойств без web (было 22), 1990 web-алиасов совпадают с прежним сидом по именам, 615 поправок; значений и инвариантов меньше на 62 — значения удалённых свойств
- [x] 3.3 Вместо dry run на отдельной базе (ds-service смотрит в dev-базу) — сверка SQL: на чистой базе нет свойств без web-алиаса, а именно они давали `Absent from meta`
