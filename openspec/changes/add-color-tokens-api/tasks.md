## 1. Подготовка

- [ ] 1.1 Начать после реализации `add-color-tokens-editor`; убедиться, что ветка основана на актуальной палитре темы (`feature/ds-service-palette-api`, после слияния salute-developers/design-system-builder#101 и #105 — `feature/ds-service`), а `TenantPaletteRepository`, `PaletteOperations.assignTokenGroup` и группы манифеста с `origin: ds-service` доступны

## 2. Domain

- [ ] 2.1 Реализовать в `feature-themes/domain` `TokenNameRule` и `TokenValueRule` с `PaletteStepKey` по правилам `design.md`
- [ ] 2.2 Покрыть правила unit-тестами: HEX трёх длин, ссылки с прозрачностью и без, граничные значения прозрачности, отсутствующая ступень, форма `paletteId`, градиенты web, ios и android, недопустимые имена

## 3. Application

- [ ] 3.1 Описать команду `SaveTenantTokenChanges`, `NewToken`, `TokenRef`, `TokenChangeValue` и `TenantTokenChangesOutcome`; `TenantTokenChangesLock` и `ResolvedTokenChanges`; расширить `TenantRepository` методами `lockForTokenChanges` и `applyTokenChanges`
- [ ] 3.2 Реализовать `SaveTenantTokenChangesUseCase`: права `tenants:write`, `tokens:write`, `tokens:delete`, блокировка, `initialize` и снимок палитры, проверки адресов и дубликатов, имён и значений по ступеням снимка, привязки через `PaletteOperations.assignTokenGroup` и `TenantPaletteRepository.save`, отображение результатов в `DsFailure` с кодами `TENANT_EDIT_CONFLICT`, `TOKEN_NAME_CONFLICT`, `INVALID_TOKEN_NAME`, `INVALID_TOKEN_VALUE`, `invalid_tenant_token`
- [ ] 3.3 Подключить `TokenValueRule` к `SaveTenantTokenValuesUseCase` для токенов `color` и `gradient` со ступенями из снимка палитры темы
- [ ] 3.4 Покрыть оба use case тестами с поддельным репозиторием: права каждой роли, ошибки, отсутствие частичных изменений

## 4. Data

- [ ] 4.1 Реализовать `lockForTokenChanges` (`FOR UPDATE OF tenants`, темы дизайн-системы в порядке `id` при непустых `create` или `delete`) и `applyTokenChanges` в `ExposedTenantRepository`: вставка определений, замена значений темы, копия значений новых токенов в другие темы, удаление токенов, увеличение ревизий изменённых тем
- [ ] 4.2 Отобразить нарушение уникальности `tokens` в `TOKEN_NAME_CONFLICT` в `PostgresTransactionFailureMapper`

## 5. Presentation и контракт

- [ ] 5.1 Добавить DTO `SaveTenantTokenChangesRequest`, `CreateTokenItem`, `TokenChangeValueItem`, `SaveTenantTokenChangesResponse`, `CreatedTokenDto` и маршрут `POST /tenants/{id}/token-changes` в `TenantRoutes`
- [ ] 5.2 Зарегистрировать use case в `ThemesModule` и маршрут в `Application`
- [ ] 5.3 Добавить операцию в группу `contracts/route-manifest.json` с `origin: ds-service` и в `app/src/main/resources/openapi/documentation.yaml` с `x-permission`, схемами и кодами ошибок; обновить `consumer-route-audit.json` для `js/apps/client`, `OpenApiDocumentResourceTest` и тесты манифеста db-service
- [ ] 5.4 Покрыть интеграционными тестами на Testcontainers в `DsServiceHttpPostgresIntegrationTest`: успешное сохранение с копией в другую тему и привязкой к группе, откат при ошибке значения, конфликт ревизии, увеличение ревизий других тем, `403` для Editor при удалении, `409 TOKEN_NAME_CONFLICT`, проверка значений в `PUT token-values`

## 6. Клиент

- [ ] 6.1 Реализовать `js/apps/client/src/modules/colorTokens/data/atomicThemeSaveRepository.ts` с адресацией значений новых токенов по имени, `paletteGroupId` и разбором ошибок, включая адрес `INVALID_TOKEN_VALUE`
- [ ] 6.2 Покрыть адаптер тестами с подменой `http`
- [ ] 6.3 Переключить сохранение темы на атомарный адаптер и удалить адаптер `legacy` и его тесты

## 7. Локальные проверки

- [ ] 7.1 `cd backend-kt/ds-service && ./gradlew test detekt spotlessCheck build`
- [ ] 7.2 `cd js/apps/client && npm test && npm run build && npm run lint`
- [ ] 7.3 `tools/verify fast --change add-color-tokens-api` и `tools/verify full --change add-color-tokens-api`

## 8. Внешние проверки до архивирования

- [ ] 8.1 [внешняя проверка] На локальном контуре в дизайн-системе с двумя темами под maintainer создать токен с категорией Accent, удалить существующий токен и сохранить тему; результат — один запрос `token-changes` со статусом `200`, в БД значения нового токена есть в обеих темах, привязка к группе accent только в первой теме, удалённого токена нет, ревизии обеих тем увеличены
- [ ] 8.2 [внешняя проверка] Отправить сохранение со ссылкой на отсутствующую ступень палитры и убедиться, что получен `400 INVALID_TOKEN_VALUE`, клиент показывает токен, платформу и режим, а данные в БД не изменились
- [ ] 8.3 [внешняя проверка] Выполнить на локальной БД выборку цветовых и градиентных значений, не проходящих `TokenValueRule`; результат — число и примеры таких значений, записанные в state
