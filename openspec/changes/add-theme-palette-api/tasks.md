## 1. Предусловие

- [ ] 1.1 Убедиться, что `add-theme-palette-editor` влит или доступен в ветке: DTO `src/modules/palette/domain/types.ts` и эталон `palette-golden.json` совпадают с контрактом этого изменения

## 2. Схема ds-service

- [ ] 2.1 Добавить `backend-kt/ds-service/app/src/main/resources/db/migration/V3__tenant_palette.sql`: enum `palette_ramp_origin`, таблицы `tenant_palette_groups`, `tenant_palette_ramps`, `tenant_palette_steps` с внешними ключами и уникальностью; не добавлять drizzle-миграций в `js/services/db-service`
- [ ] 2.2 Перестроить `FlywayPostgresIntegrationTest`: три миграции, отпечаток принятой базы на цели `1`
- [ ] 2.3 Описать таблицы как внутренние Exposed-объекты в `feature-themes/data`

## 3. Домен палитры темы

- [ ] 3.1 Реализовать в `feature-themes/domain` разбор обеих форм ссылки, группу токена, состав групп, вычисление ступени и цвета значения, перестройку и отображаемые имена
- [ ] 3.2 Покрыть домен тестами на эталоне `js/apps/client/src/modules/palette/fixtures/palette-golden.json` (подключить файл как тестовый ресурс в `feature-themes/build.gradle.kts`)

## 4. Прикладной слой и хранилище

- [ ] 4.1 Описать порт `TenantPaletteRepository` и реализовать `ExposedTenantPaletteRepository`: состояние палитры, связи цветовых токенов темы, блокировка тенанта и сравнение `editRevision`, запись групп, растяжек и ступеней, переписывание ссылок в форме `PUT /tenants/{id}/token-values`, увеличение `edit_revision`
- [ ] 4.2 Реализовать по одному `*UseCase` на чтение палитры, связи и каждую операцию изменения с проверкой `tenants:read` или `tenants:write`, `canEdit` и кодами ошибок палитры
- [ ] 4.3 Покрыть use case тестами с поддельным хранилищем и `ImmediateTransactions`, включая `403`, `404`, `409 TENANT_EDIT_CONFLICT` и все коды палитры
- [ ] 4.4 Добавить `resolvePalette` в `GetTenantTokenValuesUseCase` и поле `paletteRef` в `TenantTokenValueResponse`

## 5. HTTP и контракт

- [ ] 5.1 Реализовать DTO запросов и ответов и `TenantPaletteRoutes` под `/api/ds/tenants/{tenantId}/palette`, зарегистрировать маршруты и use case в `ThemesModule` и `Application.kt`
- [ ] 5.2 Добавить маршруты палитры в `contracts/route-manifest.json` с признаком `"origin": "ds-service"` и правами `tenants:read`/`tenants:write`
- [ ] 5.3 Научить `OpenApiDocumentFactory` описывать операции с `"origin": "ds-service"` по DTO `ds-service`, обновить `OpenApiDocumentFactoryTest` и число операций в нём и в `DsServiceHttpPostgresIntegrationTest`
- [ ] 5.4 Написать HTTP-тесты на Testcontainers: чтение, связи, каждая операция, конфликт ревизии, сохранение токенов после операции палитры, права viewer и ключа без `tenants:write`, чужой проект, независимость палитр двух тем, `token-values?resolvePalette=true`

## 6. CLI

- [ ] 6.1 Запрашивать `token-values?resolvePalette=true` в `frontend-kt/feature-theme` `HttpRemoteThemeDataSource` и принимать необязательное `paletteRef`
- [ ] 6.2 Обновить тесты `theme fetch` под новый запрос и вычисленные цвета

## 7. Клиент

- [ ] 7.1 Сделать `api` значением по умолчанию `VITE_PALETTE_SOURCE` и обновить описание переменной
- [ ] 7.2 Проверить адаптер `api` клиента против реального ответа `ds-service` и привести расхождения DTO, если они есть, в обеих сторонах

## 8. Локальные проверки

- [ ] 8.1 `cd backend-kt/ds-service && ./gradlew test detekt spotlessCheck build` с запущенным Docker
- [ ] 8.2 `cd backend-kt && ./gradlew verifyFast`
- [ ] 8.3 `cd frontend-kt && ./gradlew build`
- [ ] 8.4 `cd js/apps/client && npm test && npm run build && npm run lint`
- [ ] 8.5 `tools/verify fast --change add-theme-palette-api` и `tools/verify full --change add-theme-palette-api`

## 9. Внешние проверки до архивирования

- [ ] 9.1 [внешняя проверка] Поднять локальный контур, убедиться, что Flyway применил `V3` к существующей базе `ds_registry` без ошибок проверки отпечатка
- [ ] 9.2 [внешняя проверка] Под `admin@example.com` в режиме `api` выполнить сценарий раздела «Палитра»: «Поменять», «Изменить», правку ступени, добавление и удаление растяжки с заменой и как Custom, создание и удаление группы; после перезагрузки страницы и в другом браузере палитра та же
- [ ] 9.3 [внешняя проверка] Открыть одну тему в двух вкладках, изменить палитру в первой и выполнить операцию во второй: вторая получает `409 TENANT_EDIT_CONFLICT` и перезагружает палитру
- [ ] 9.4 [внешняя проверка] Под пользователем с ролью viewer убедиться, что раздел только для чтения, а запрос изменения через gateway возвращает `403`
- [ ] 9.5 [внешняя проверка] После перестройки растяжки Accent выполнить `dsbuilder theme fetch` против локального gateway: цвет `text.default.accent` в файлах тенанта равен вычисленному значению палитры темы
