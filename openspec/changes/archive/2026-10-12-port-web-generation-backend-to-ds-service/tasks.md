## 1. Контракт

- [x] 1.1 Добавить в `backend-kt/ds-service/contracts/route-manifest.json` операцию `POST /component-config/web-adapter` группы `component-config` (`ComponentWebAdapterRequest`, `ComponentWebAdapter`, `200`, `components:read`) и источник `src/routes/api/component-config-web-adapter.ts`.
- [x] 1.2 Описать маршрут в `app/src/main/resources/openapi/documentation.yaml`: тело запроса, схема ответа с необязательными полями, ответы `400`, `403`, `404`, `x-permission: components:read`.
- [x] 1.3 Уточнить в `documentation.yaml` описание `/api/ds/component-config/export` (источник `adjustment`)

## 2. Web-адаптер в `feature-components`

- [x] 2.1 Добавить domain-модель `ComponentWebAdapterEntry`, порт `ComponentWebAdapterRepository` и `GetComponentWebAdapterUseCase` с проверкой `components:read` и отображением недоступной дизайн-системы в `DsFailure.NotFound`.
- [x] 2.2 Реализовать `ExposedComponentWebAdapterRepository`: состав компонентов по `appearances`, шаблоны web-параметров из поправок значений вариаций и инвариантов с выбором наименьшего, compose-связи между компонентами пакета в порядке связи, детерминированная сортировка.
- [x] 2.3 Добавить `ComponentWebAdapterRequest`, DTO ответа без кодирования пустых полей и маршрут `POST /api/ds/component-config/web-adapter` с ответом `400` на некорректный `designSystemId`.
- [x] 2.4 Зарегистрировать репозиторий и UseCase в `ComponentModelModule`, передать UseCase в маршруты из `Application.kt`.

## 3. Смещения в выгрузке

- [x] 3.1 Добавить в `data` источник смещений из `variation_platform_param_adjustments` и `invariant_platform_param_adjustments`: только числовые поправки, не совпадающие со значением строки или именем токена, приоритет web, xml, compose, ios.
- [x] 3.2 Подключить источник в `ComponentConfigBuilder` отдельным признаком `withPlatformOffsets`, который выставляет только выгрузка, для инвариантов и значений вариаций; собственный `adjustment` строки имеет приоритет, чтение одного конфига и сравнение в импорте смещений не видят.

## 4. Ссылки на палитру в `feature-themes`

- [x] 4.1 Не переносить ссылки на палитру в `token-values`: формат ответа задаёт `theme-palette-api` (решение 3 `design.md`, замечание ревью).

## 5. Снимок компонентов

- [x] 5.1 Заменить в `feature-components/src/main/resources/component-seeds.json` ссылку `List.listItemDividerWidth` на `listItemDividerHeight` и обновить контрольную сумму в `ComponentSeedsResourceTest`, добавив проверку отсутствия старого имени.

## 6. Тесты

- [x] 6.1 Модульные тесты `GetComponentWebAdapterUseCase`: успех, отказ без `components:read` без обращения к репозиторию, `NotFound` для недоступной дизайн-системы.
- [x] 6.2 Контрактный тест ответа web-адаптера: пустые `description`, `compose`, `styles` отсутствуют в JSON; порядок записей и ключей стабилен.
- [x] 6.4 Тесты источника смещений на разбор числа: целое, дробное, отрицательное, пустая строка, нечисловая строка, копия значения.
- [x] 6.5 Покрыть интеграционным тестом на PostgreSQL (`WebGenerationPostgresIntegrationTest`) сценарий web-адаптера: шаблоны по стилям, выбор наименьшего шаблона, compose только между компонентами пакета, пустая дизайн-система, `404` для чужой дизайн-системы, `403` без permission, `400` для некорректного тела.
- [x] 6.6 Покрыть в `WebGenerationPostgresIntegrationTest` сценарий выгрузки: смещение из поправки с приоритетом web, приоритет собственного `adjustment`, отсутствие подстановки в `GET /api/ds/component-config`.

## 7. Локальные проверки

- [x] 7.1 Выполнить `cd backend-kt/ds-service && ./gradlew build`; при замечаниях форматирования — `spotlessApply` и повторная сборка.
- [x] 7.2 Выполнить `cd js/services/db-service && npx vitest run src/routes/route-manifest.test.ts` и `cd backend-kt/api-reference && npm test` — потребители манифеста и `documentation.yaml`.
- [x] 7.3 Выполнить `tools/verify fast --change port-web-generation-backend-to-ds-service`, независимое review и `tools/verify full --change port-web-generation-backend-to-ds-service`.

## 8. Внешние проверки до архивации

- [x] 8.1 [внешняя проверка] На одной локальной базе с prod-сидами запросить у `db-service` и `ds-service` `POST component-config/web-adapter`, и `POST component-config/export` для одной дизайн-системы; сравнить ответы через `jq -S`. Успех: расхождений в данных нет; порядок camelCase-ключей web-адаптера может отличаться по правилу из решения 4 `design.md`. Сохранить команды, коды ответов и итог сравнения.
