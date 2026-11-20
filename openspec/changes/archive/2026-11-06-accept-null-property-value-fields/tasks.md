## 1. Маршруты ds-service

- [x] 1.1 `VariationPropertyValueRoutes.kt`: в `POST` и `PATCH` не проверять `null` у `tokenId`, `value`, `alpha`, `adjustment`; `stateSetId` проверять как прежде
- [x] 1.2 `InvariantPropertyValueRoutes.kt`: то же для `POST` и `PATCH`
- [x] 1.3 Отметить эти поля в OpenAPI (`runtime/src/main/resources/openapi/documentation.yaml`) как допускающие `null`

## 2. Тесты

- [x] 2.1 Тесты маршрутов вариационных значений: смена токена с `null`-полями, переход на сырое значение, поле не передано, `stateSetId: null` → `400`
- [x] 2.2 Тесты маршрутов инвариантных значений: создание и изменение с `null`-полями (оба сценария — в `ComponentPlatformHttpPostgresIntegrationTest`)
- [x] 2.3 `JAVA_TOOL_OPTIONS=-Dapi.version=1.44 ./gradlew :ds-service:feature-components:check :ds-service:runtime:check` проходит (корневой `build` модули ds-service не включает)

## 3. Проверка

- [x] 3.1 [внешняя проверка] Пересобрать локальный бэкенд, сменить в редакторе цвет `Chip` и размер `Button`: автосохранение без ошибки, значения видны после перезагрузки, затем вернуть исходные значения
