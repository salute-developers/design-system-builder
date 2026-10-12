## Why

Редактор цветовых токенов (`add-color-tokens-editor`) сохраняет правки автоматически, по одному токену. В
`ds-service` для этого нет операций: `POST /tokens` создаёт только определение без значений, `PUT
/tenants/{id}/token-values` полностью заменяет все значения темы, `DELETE /tokens/{id}` удаляет одно
определение. Цветовой токен экрана — это несколько определений (подтемы, состояния `-hover` и `-active`),
поэтому создать токен со значениями во всех темах, изменить только его значения или удалить его целиком одной
транзакцией нельзя. Кроме того, `ds-service` не проверяет цветовые значения.

Изменение добавляет атомарные операции над отдельным цветовым токеном. Это готовит API к будущему
многопользовательскому режиму: пользователи меняют разные токены независимо, не отправляя полное состояние
темы.

## What Changes

- Цветовой токен — семейство определений с общими группой и именем: `<group>.<subgroup>.<name>` для
  подгрупп `default`, `on-dark`, `on-light`, `inverse` (у `background` — `dark`, `light`, `inverse`) и
  состояния `<name>-hover`, `<name>-active`, `<name>-brightness`. Операции адресуют семейство целиком.
- `POST /api/ds/tenants/{tenantId}/color-tokens` в одной транзакции создаёт все определения семейства,
  записывает начальные значения во все темы дизайн-системы и явную привязку к группе палитры текущей темы.
- `PUT /api/ds/tenants/{tenantId}/color-tokens/{tokenId}/values` заменяет значения переданных определений
  семейства только в текущей теме; значения других токенов и других тем не меняются.
- `DELETE /api/ds/tenants/{tenantId}/color-tokens/{tokenId}` удаляет все определения семейства вместе со
  значениями во всех темах и привязками к группам палитры.
- Каждая операция сверяет и увеличивает общий `editRevision` текущей темы и возвращает новое значение;
  устаревшая ревизия даёт `409 TENANT_EDIT_CONFLICT`. Создание и удаление дополнительно увеличивают ревизии
  остальных тем дизайн-системы, потому что меняют их строки значений. Конфликт при параллельной правке разных
  токенов одной темы — принятое временное ограничение.
- Права: значения — `tenants:write`; создание — дополнительно `tokens:write`; удаление — дополнительно
  `tokens:delete`.
- Проверка значений цветовых и градиентных токенов в новых операциях и в `PUT /tenants/{id}/token-values`:
  HEX `#RGB`, `#RRGGBB`, `#RRGGBBAA`; ссылка `[type.shade.step]` с необязательной прозрачностью на ступень
  палитры темы; форма `paletteId`; для web-значения градиента — CSS-градиент или HEX. **BREAKING** для
  клиентов, которые записывали в цветовые токены произвольные строки: они получат `400 INVALID_TOKEN_VALUE`.
- Операции описываются в группе `contracts/route-manifest.json` с `origin: ds-service` и в
  `app/src/main/resources/openapi/documentation.yaml`.

Вне изменения: пакетное сохранение изменений темы, гранулярные ревизии отдельных токенов и полноценный
многопользовательский режим, переименование токенов и правка метаданных, доставка новых токенов в generator.

## Порядок реализации

1. Палитра темы: `add-theme-palette-editor` и `add-theme-palette-api` (PR
   salute-developers/design-system-builder#101 и #105, заархивированы).
2. `add-color-tokens-api` — это изменение. Реализуется первым: автосохранение редактора опирается на его
   операции.
3. `add-color-tokens-editor` — клиент экрана токенов с автосохранением.

## Capabilities

### New Capabilities

- `color-token-operations-api`: атомарные создание, изменение значений и удаление цветового токена темы с
  общей ревизией темы.
- `color-token-value-validation`: проверка цветовых и градиентных значений токенов при записи.

### Modified Capabilities

- Нет.

## Impact

- `backend-kt/ds-service`:
  - `feature-themes`: domain `ColorTokenFamily`, `TokenNameRule`, `TokenValueRule`; application — порт
    `ColorTokenRepository` и use case `CreateColorTokenUseCase`, `UpdateColorTokenValuesUseCase`,
    `DeleteColorTokenUseCase`; привязка к группе и ступени палитры — через существующий
    `TenantPaletteRepository` и `PaletteOperations`; data — `ExposedColorTokenRepository` поверх `tokens`
    и `token_values`; presentation — маршруты и DTO; проверка значений в `SaveTenantTokenValuesUseCase`;
  - `app`: регистрация маршрутов, `openapi/documentation.yaml`;
  - `contracts/route-manifest.json`, `contracts/consumer-route-audit.json`, `OpenApiDocumentResourceTest`,
    тесты манифеста db-service, интеграционные тесты на Testcontainers.
- Схема БД и Flyway-миграции: без изменений.
- `authorization/policy.json`: без изменений.
- `js/apps/client`, `js/services/db-service`, `frontend-kt`, gateway: без изменений в этом изменении;
  клиент переходит на операции в `add-color-tokens-editor`.
