## 1. Подготовка

- [x] 1.1 Убедиться, что ветка основана на актуальной палитре темы (`feature/ds-service-palette` с влитым salute-developers/design-system-builder#105, после слияния #101 — `feature/ds-service`), а `TenantPaletteRepository`, `PaletteOperations.assignTokenGroup` и группы манифеста с `origin: ds-service` доступны

## 2. Domain

- [x] 2.1 Реализовать в `feature-themes/domain/colortokens` `ColorTokenFamily` с правилом членов семейства, `TokenNameRule` и `TokenValueRule` по копии шаблона палитры по правилам `design.md`
- [x] 2.2 Покрыть правила unit-тестами: члены семейства для всех подгрупп, `background` и состояний, имена вне правила; HEX трёх длин, ссылки с прозрачностью и без, граничные прозрачности, отсутствующая ступень, форма `paletteId`, градиенты web, ios и android; недопустимые имена

## 3. Application

- [x] 3.1 Описать порт `ColorTokenRepository`, команды `CreateColorToken`, `UpdateColorTokenValues`, `ColorTokenLock` и результаты
- [x] 3.2 Реализовать `CreateColorTokenUseCase`: права, проверка имён и семейства, блокировка всех тем дизайн-системы, `initialize` и снимок палитры, проверка значений, вставка определений и значений во все темы, привязка через `PaletteOperations.assignTokenGroup` и `TenantPaletteRepository.save`, увеличение ревизий
- [x] 3.3 Реализовать `UpdateColorTokenValuesUseCase`: права, семейство по `tokenId`, принадлежность членов семейству, блокировка текущей темы, проверка значений, замена значений переданных членов, увеличение ревизии текущей темы
- [x] 3.4 Реализовать `DeleteColorTokenUseCase`: права, семейство по `tokenId`, блокировка всех тем, удаление определений семейства, увеличение ревизий
- [x] 3.5 Подключить `TokenValueRule` к `SaveTenantTokenValuesUseCase` для токенов `color` и `gradient` со ступенями из снимка палитры темы
- [x] 3.6 Покрыть use case тестами с поддельными репозиториями: права каждой роли, все коды ошибок, отсутствие частичных изменений, ревизии текущей и других тем

## 4. Data

- [x] 4.1 Реализовать `ExposedColorTokenRepository`: блокировка `FOR UPDATE OF tenants` текущей темы или всех тем дизайн-системы в порядке `id`, чтение семейства, вставка определений и значений, замена значений членов в одной теме, удаление определений, увеличение ревизий
- [x] 4.2 Отсекать дубль имени при создании проверкой `takenNames` под блокировкой тем дизайн-системы, не меняя ответы `POST` и `PATCH /tokens`; добавить в порт палитры лёгкое чтение копии шаблона `template`
- [x] 4.3 Зарегистрировать репозиторий и use case в `ThemesModule`

## 5. Presentation и контракт

- [x] 5.1 Добавить DTO `CreateColorTokenRequest`, `ColorTokenMemberValues`, `UpdateColorTokenValuesRequest`, `ColorTokenMemberValuesById`, `ColorTokenValueItem`, `DeleteColorTokenRequest`, `ColorTokenMutationResponse`, `ColorTokenFamilyDto`, `ColorTokenMemberDto`, `ColorTokenRevisionResponse` и маршруты `ColorTokenRoutes`; зарегистрировать их в `Application`
- [x] 5.2 Добавить операции в группу `contracts/route-manifest.json` с `origin: ds-service` и в `app/src/main/resources/openapi/documentation.yaml` с `x-permission`, схемами и кодами ошибок; обновить `consumer-route-audit.json` для `js/apps/client`, `OpenApiDocumentResourceTest` и тесты манифеста db-service
- [x] 5.3 Покрыть интеграционными тестами на Testcontainers: создание с копией значений в другую тему и привязкой к группе, изменение значений одного токена без изменения других токенов и тем, удаление с данными во всех темах, конфликт ревизии, ревизии других тем, `403` для Viewer и для Editor при удалении, `409 TOKEN_NAME_CONFLICT`, `400 INVALID_TOKEN_FAMILY`, `400 INVALID_TOKEN_VALUE` без изменения данных, проверка значений в `PUT token-values`

## 6. Локальные проверки

- [x] 6.1 `cd backend-kt/ds-service && ./gradlew test detekt spotlessCheck build`
- [x] 6.2 `tools/verify fast --change add-color-tokens-api` и `tools/verify full --change add-color-tokens-api`

## 7. Внешние проверки до архивирования

- [x] 7.1 [внешняя проверка] На локальном контуре через gateway в дизайн-системе с двумя темами под maintainer создать цветовой токен с группой accent, изменить его значения в первой теме и удалить его; результат — ответы `201`, `200`, `200`; после создания значения есть в обеих темах, привязка к группе accent только в первой теме, ревизии обеих тем увеличены; после изменения значения поменялись только у этого токена в первой теме; после удаления в БД нет определений семейства, значений и привязок
- [x] 7.2 [внешняя проверка] Отправить изменение значений со ссылкой на отсутствующую ступень палитры и с устаревшей ревизией; результат — `400 INVALID_TOKEN_VALUE` с `details.address` и `409 TENANT_EDIT_CONFLICT`, данные в БД не изменились
- [x] 7.3 [внешняя проверка] Выполнить на локальной БД выборку цветовых и градиентных значений, не проходящих `TokenValueRule`; результат — число и примеры таких значений, записанные в state
