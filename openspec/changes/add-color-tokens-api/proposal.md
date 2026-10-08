## Why

Клиент из `add-color-tokens-editor` сохраняет тему адаптером `legacy`: создаёт определения токенов, заменяет
значения темы, удаляет токены и записывает привязку к группе палитры отдельными запросами. Такое сохранение
не атомарно, а созданный токен получает значения только в сохраняемой теме — в остальных темах дизайн-системы
он остаётся неполным. Кроме того, `ds-service` не проверяет цветовые значения: в тему можно записать любую
строку вместо HEX или ссылки на палитру.

Изменение добавляет в `ds-service` атомарную операцию сохранения изменений токенов темы, копирует значения
нового токена в остальные темы, проверяет цветовые значения и переключает клиент на эту операцию.

## What Changes

- Новая операция `POST /api/ds/tenants/{tenantId}/token-changes` в одной транзакции:
  - создаёт определения цветовых и градиентных токенов дизайн-системы;
  - полностью заменяет значения выбранной темы, как `PUT /tenants/{id}/token-values`, причём значения новых
    токенов адресуются по имени;
  - копирует значения новых токенов выбранной темы в остальные темы дизайн-системы;
  - записывает явную привязку нового токена к группе палитры темы;
  - удаляет запланированные токены дизайн-системы;
  - увеличивает `editRevision` выбранной темы и тех тем, чьи значения изменились.
- Права: `tenants:write`; при создании токенов дополнительно `tokens:write`, при удалении — `tokens:delete`.
- Ошибки: `409 TENANT_EDIT_CONFLICT` с актуальным `editRevision`, `409 TOKEN_NAME_CONFLICT`,
  `400 INVALID_TOKEN_NAME`, `400 INVALID_TOKEN_VALUE` с адресом значения, `400 invalid_tenant_token`.
- Проверка значений цветовых и градиентных токенов в новой операции и в `PUT /tenants/{id}/token-values`:
  HEX `#RGB`, `#RRGGBB`, `#RRGGBBAA`; ссылка `[type.shade.step]` с необязательной прозрачностью `[0..1]` на
  ступень палитры темы; форма `paletteId` с пустым значением или прозрачностью; для web-значения градиента —
  CSS-градиент или HEX. **BREAKING** для клиентов, которые записывали в цветовые токены произвольные строки:
  такие запросы получат `400 INVALID_TOKEN_VALUE`.
- Операция описывается в группе `contracts/route-manifest.json` с `origin: ds-service` и в статическом
  контракте `app/src/main/resources/openapi/documentation.yaml` с `x-permission`, как операции палитры темы.
- Клиент получает адаптер атомарного сохранения и переходит на него; адаптер `legacy` удаляется.

Вне изменения: переименование токенов, отслеживание изменений, поплатформенная правка значений в клиенте,
доставка новых токенов в generator.

## Порядок реализации

1. Палитра темы: `add-theme-palette-editor` и `add-theme-palette-api` (PR
   salute-developers/design-system-builder#101 и #105, заархивированы).
2. `add-color-tokens-editor` — клиент экрана токенов.
3. `add-color-tokens-api` — это изменение. Опирается на копию шаблона палитры темы и операции привязки
   токена к группе из шага 1.

## Capabilities

### New Capabilities

- `theme-token-changes-api`: атомарное сохранение изменений токенов темы с созданием, копированием значений
  в другие темы, привязкой к группе палитры и удалением.
- `color-token-value-validation`: проверка цветовых и градиентных значений токенов при записи.

### Modified Capabilities

- `tenant-aware-theme-editor`: клиент сохраняет тему одним атомарным запросом.

## Impact

- `backend-kt/ds-service`:
  - `feature-themes`: domain `TokenValueRule`, `TokenNameRule`; application `SaveTenantTokenChangesUseCase`,
    команда и результат, расширение `TenantRepository`; привязки и ступени палитры — через существующий
    порт `TenantPaletteRepository` и операции `PaletteOperations`; data — реализация в
    `ExposedTenantRepository` поверх `tokens` и `token_values`; presentation — маршрут, DTO запроса и ответа;
    проверка значений в `SaveTenantTokenValuesUseCase`;
  - `app`: регистрация маршрута, `openapi/documentation.yaml`;
  - `contracts/route-manifest.json`, `contracts/consumer-route-audit.json`, `OpenApiDocumentResourceTest`,
    тесты манифеста db-service и интеграционные тесты на Testcontainers.
- Схема БД и Flyway-миграции: без изменений.
- `authorization/policy.json`: без изменений.
- `js/apps/client`: `modules/colorTokens/data/atomicThemeSaveRepository.ts`, удаление адаптера `legacy`.
- `js/services/db-service`, `frontend-kt`, gateway: без изменений.
