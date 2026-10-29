## Why

Gateway уже направляет `/api/projects/{projectId}/ds/**` в Kotlin-сервис `ds-service`, но тот перенесён с состояния `db-service` до задач PLASMABLDR-186 и PLASMABLDR-187. Из-за этого локальная web-генерация через новый бэкенд не работает: `components fetch` для React получает `404` на `web-adapter`, а выгрузка компонентов теряет смещения значений.

## What Changes

- В `ds-service` появляется `POST /api/ds/component-config/web-adapter`: шаблоны web-параметров, compose-связи, имена и описания компонентов дизайн-системы. Контракт ответа совпадает с ручкой `db-service` из PLASMABLDR-187, доступ — `components:read` и принадлежность дизайн-системы проекту.
- `POST /api/ds/component-config/export` в `ds-service` возвращает `adjustment` из числовых поправок платформенных параметров, когда у строки значения смещения нет (приоритет web, xml, compose, ios). Чтение одного конфига `GET /api/ds/component-config` не меняется.
- В снимке `component-seeds.json` свойство `List.listItemDividerWidth` переименовывается в `listItemDividerHeight`, как в сидах `db-service`. Сейчас на базе с актуальными метаданными снимок ссылается на несуществующее свойство, и инициализация конфигураций компонентов при создании темы молча не выполняется.
- Контрактные артефакты `ds-service` (`route-manifest.json`, `documentation.yaml`) дополняются новой ручкой и уточнёнными описаниями.

Не переносится, потому что в `ds-service` этому нет соответствия:

- начальная опубликованная версия `0.1.0` у дизайн-системы `base` — `ds-service` не заводит `base` и не владеет prod-сидером;
- удаление web-параметра `iconButtonPadding` у `IconButton.paddingEnd` — это глобальные метаданные свойств, в снимке `ds-service` их нет;
- ссылки на палитру в `GET /tenants/:id/token-values` из PLASMABLDR-186 — для `ds-service` формат этого ответа задаёт `theme-palette-api`: цвета раскрываются по палитре темы, исходная ссылка отдаётся в `paletteRef`. Ссылка, раскрытая потребителем по общей палитре, дала бы неверные цвета темы с изменённой палитрой.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `design-system-model-api`: `ds-service` обязан обслуживать web-адаптер, восстанавливать смещения в выгрузке компонентов и держать снимок конфигураций компонентов согласованным с именами свойств глобального слоя.

## Impact

- `backend-kt/ds-service/feature-components`: новый сценарий web-адаптера во всех слоях (`domain`, `application`, `data`, `presentation`, `di`), источник смещений в сборщике выгрузки, правка `component-seeds.json` и контрольной суммы в `ComponentSeedsResourceTest`.
- `backend-kt/ds-service/feature-themes`: без изменений.
- `backend-kt/ds-service/app`: регистрация маршрута, `openapi/documentation.yaml`, интеграционные тесты на PostgreSQL.
- `backend-kt/ds-service/contracts/route-manifest.json`: новая операция группы `component-config`.
- `backend-kt/identity-gateway`, `backend-kt/authorization-core/authorization/policy.json`: без изменений — маршрут попадает под существующий префикс, permission `components:read` уже есть.
- `frontend-kt/cli`, `js/cli`: без изменений кода; это потребители, ради которых делается перенос.
- `js/services/db-service`: остаётся эталоном поведения, код не меняется.
- PostgreSQL: схема и миграции не меняются. Перед выкладкой на стенд с прежними метаданными нужно переименование свойства `List.listItemDividerWidth` (см. план выкладки в `design.md`).
