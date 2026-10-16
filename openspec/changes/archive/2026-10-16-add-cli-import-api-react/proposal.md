## Why

`dsbuilder components import-api` заводит глобальный слой компонентной модели по мете Compose и Android View, а для `react` отказывает сообщением «not supported yet». Веб-мета при этом уже есть: `npm run generate:api-meta` в `js/cli` строит `web-api-meta.json` по JSDoc-аннотациям словарей CSS-токенов пакета компонентов. Web-параметры свойств (`property_platform_params` с `platform = web`) сейчас заводят только сиды, и новые токены пакета в базу сами не попадают.

Мета готова к импорту. Замер на `@salutejs/plasma-new-hope@0.384.0-dev.0`: 64 компонента, у 59 есть токены, 2535 токенов, 1887 уникальных пар `(компонент, id)`, конфликтов типа нет, все типы входят в `property_type`. Свойств, у которых были бы только токены состояний, нет. Все `@styleState` (`hovered`, `pressed`, `focused`, `selected`) относятся к общему словарю состояний взаимодействия.

## What Changes

- **frontend-kt**: нормализатор `WebApiMetaNormalizer` приводит веб-мету к тому же манифесту, что у Compose и View, и регистрируется для `TargetPlatform.REACT`. На backend мета уходит с `platform = web`.
- Правила: токены сводятся в свойство по `(componentName, id)`. Платформенные имена — ключи токенов без `state`, как в сидах и веб-генерации. Токены состояний именами не становятся. Состояния взаимодействия не заводятся как состояния компонента. `deprecated` относится к токену.
- Компонент веб-меты без токенов (файл токенов без словаря: `AvatarGroup`, `Image`, `Popup`, `Price`, `Resizable`) попадает в манифест без свойств, и backend заводит его как компонент. У Compose и View правило прежнее.
- Документация: `cli/USAGE.md` и `feature-components/API_META_NORMALIZERS.md`.

Не входит: изменения backend, db-service и генератора веб-меты; импорт на стенды; сверка имён веб-компонентов из меты с сидами (её покажет dry run).

## Capabilities

### New Capabilities
Нет.

### Modified Capabilities
- `cli-components`: платформа `react` в `import-api`, нормализация веб-меты, чтение `deprecated` веб-меты.

## Impact

- **frontend-kt**: `feature-components` (нормализатор, регистрация, корпус и тесты), `cli` (сквозной тест, `USAGE.md`).
- **backend-kt**, **js**: не затрагиваются. Backend уже принимает `web`, а `TargetPlatform.REACT.toApiMetaPlatform()` уже даёт `web`.
- **Данные**: веб-компоненты в базе есть из сидов, и импорт пополняет их же по паре `(имя, web)`. Если имена в мете расходятся с сидами, появятся дубли, поэтому первый запуск — dry run.
