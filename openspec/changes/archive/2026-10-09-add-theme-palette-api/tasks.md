## 1. Предусловие

- [x] 1.1 Начинать реализацию только после слияния `add-theme-palette-editor` (сначала фронт, потом бэк) и проверить, что DTO `src/modules/palette/domain/types.ts` и эталон `palette-golden.json` совпадают с контрактом этого изменения

## 2. Схема ds-service

- [x] 2.1 Добавить `backend-kt/ds-service/app/src/main/resources/db/migration/V3__tenant_palette.sql`: enum `palette_ramp_origin` и `palette_group_kind`, таблицы `tenant_palette_template`, `tenant_palette_groups`, `tenant_palette_ramps`, `tenant_palette_steps`, `tenant_palette_token_groups` с внешними ключами, уникальностью и проверкой `kind`/`system_key`; не добавлять drizzle-миграций в `js/services/db-service`
- [x] 2.2 В `V3` скопировать общую палитру в `tenant_palette_template` и создать пять системных групп для каждого существующего тенанта
- [x] 2.3 Перестроить `FlywayPostgresIntegrationTest`: три миграции, отпечаток принятой базы на цели `1`
- [x] 2.4 Описать таблицы как внутренние Exposed-объекты в `feature-themes/data`

## 3. Домен палитры темы

- [x] 3.1 Реализовать в `feature-themes/domain` разбор обеих форм ссылки, группу токена по умолчанию и с учётом явной привязки, состав групп по копии шаблона, вычисление ступени и цвета значения, перестройку и отображаемые имена
- [x] 3.2 Покрыть домен тестами на эталоне `js/apps/client/src/modules/palette/fixtures/palette-golden.json` (подключить файл как тестовый ресурс в `feature-themes/build.gradle.kts`)

## 4. Прикладной слой и хранилище

- [x] 4.1 Описать порт `TenantPaletteRepository` и реализовать `ExposedTenantPaletteRepository`: создание копии шаблона и системных групп, состояние палитры, явные привязки токенов к группам, связи цветовых токенов темы, блокировка тенанта и сравнение `editRevision`, запись групп, растяжек и ступеней, переписывание ссылок в форме `PUT /tenants/{id}/token-values`, увеличение `edit_revision`
- [x] 4.2 Вызывать создание копии шаблона и системных групп в транзакции `CreateTenantUseCase`
- [x] 4.3 Реализовать по одному `*UseCase` на чтение палитры, связи, привязку токена к группе и каждую операцию изменения (включая переименование группы и сброс правки ступени значением источника) с проверкой `tenants:read` или `tenants:write`, `canEdit` и кодами ошибок палитры
- [x] 4.4 Покрыть use case тестами с поддельным хранилищем и `ImmediateTransactions`, включая `403`, `404`, `409 TENANT_EDIT_CONFLICT` и все коды палитры
- [x] 4.5 Добавить `resolvePalette` в `GetTenantTokenValuesUseCase` и поле `paletteRef` в `TenantTokenValueResponse`

## 5. HTTP и контракт

- [x] 5.1 Реализовать DTO запросов и ответов и `TenantPaletteRoutes` под `/api/ds/tenants/{tenantId}/palette`, зарегистрировать маршруты и use case в `ThemesModule` и `Application.kt`
- [x] 5.2 Добавить маршруты палитры в `contracts/route-manifest.json` с признаком `"origin": "ds-service"` и правами `tenants:read`/`tenants:write`
- [x] 5.3 Описать операции палитры, параметр `resolvePalette` и поле `paletteRef` в `app/src/main/resources/openapi/documentation.yaml` с `x-permission`; пропускать группы с `"origin": "ds-service"` в `js/services/db-service/src/routes/route-manifest.test.ts` и `src/test/differential-runner.ts`; обновить число операций в `OpenApiDocumentResourceTest` и `DsServiceHttpPostgresIntegrationTest`; добавить `details` в `ErrorResponse` для `PALETTE_STEP_MISSING`
- [x] 5.4 Написать HTTP-тесты на Testcontainers: копия шаблона при создании темы и неизменность палитры темы после правки общей палитры, адресация групп по `id`, привязка токена и её сброс, переименование группы (в том числе занятое имя и системная группа), сброс правки ступени значением источника, удаление группы с возвратом токенов к группе по умолчанию, чтение, связи, каждая операция, конфликт ревизии, сохранение токенов после операции палитры, права viewer и ключа без `tenants:write`, чужой проект, независимость палитр двух тем, `token-values?resolvePalette=true`

## 6. CLI

- [x] 6.1 Запрашивать `token-values?resolvePalette=true` в `frontend-kt/feature-theme` `HttpRemoteThemeDataSource` и принимать необязательное `paletteRef`
- [x] 6.2 Обновить тесты `theme fetch` под новый запрос и вычисленные цвета

## 7. Клиент

- [x] 7.1 Сделать `api` значением по умолчанию `VITE_PALETTE_SOURCE` и обновить описание переменной
- [x] 7.2 В режиме `api` после `removeRamp` перезагрузить тему и переписать ссылки в записях черновика затронутых токенов (сохранённые значения переписал сервер; записи не сбрасываются, чтобы не терять остальные правки), уведомление показывать после перезагрузки
- [x] 7.3 В режиме `api` учитывать токены, которые есть только в черновике клиента: сервер не знает их связей, поэтому перед удалением растяжки и в инспекторе связи нужно дополнять токенами черновика, а при `removeRamp` переписывать и их ссылки (в режиме `local` это сделано в `palette/paletteSession.ts`)
- [x] 7.4 Проверить адаптер `api` клиента против реального ответа `ds-service` и привести расхождения DTO, если они есть, в обеих сторонах

## 8. Локальные проверки

- [x] 8.1 `cd backend-kt/ds-service && ./gradlew test detekt spotlessCheck build` с запущенным Docker
- [x] 8.2 `cd backend-kt && ./gradlew verifyFast`
- [x] 8.3 `cd frontend-kt && ./gradlew build`
- [x] 8.4 `cd js/apps/client && npm test && npm run build && npm run lint`
- [x] 8.5 `tools/verify fast --change add-theme-palette-api` и `tools/verify full --change add-theme-palette-api`

## 9. Внешние проверки до архивирования

- [x] 9.1 [внешняя проверка] Поднять локальный контур, убедиться, что Flyway применил `V3` к существующей базе `ds_registry` без ошибок проверки отпечатка, а у каждой существующей темы есть копия шаблона (`select count(*) from tenant_palette_template group by tenant_id` равно числу строк `palette`) и пять системных групп
- [x] 9.2 [внешняя проверка] Под `admin@example.com` в режиме `api` выполнить сценарий раздела «Палитра»: «Поменять», «Изменить», правку ступени, добавление и удаление растяжки с заменой и как Custom, создание группы с переименованием на месте и привязку к ней токена, удаление группы; после перезагрузки страницы и в другом браузере палитра та же
- [x] 9.3 [внешняя проверка] Под системным администратором изменить значение ступени в общей палитре и убедиться, что палитра и цвета токенов существующей темы не изменились, а новая тема получила новое значение
- [x] 9.4 [внешняя проверка] Открыть одну тему в двух вкладках, изменить палитру в первой и выполнить операцию во второй: вторая получает `409 TENANT_EDIT_CONFLICT` и перезагружает палитру
- [x] 9.5 [внешняя проверка] Под пользователем с ролью viewer убедиться, что раздел только для чтения, а запрос изменения через gateway возвращает `403`
- [x] 9.6 [внешняя проверка] После перестройки растяжки Accent выполнить `dsbuilder theme fetch` против локального gateway: цвет `text.default.accent` в файлах тенанта равен вычисленному значению палитры темы
