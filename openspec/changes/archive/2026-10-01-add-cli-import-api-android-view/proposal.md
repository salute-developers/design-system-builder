## Why

`dsbuilder components import-api` умеет заводить глобальный слой компонентной модели только по мете Compose. Проекты Android View остаются без команды: для них `import-api` отказывает сообщением «not supported yet», а мета View (`uikit-api-meta.json`) в базу не попадает. Платформенные имена `xml` в `property_platform_params`, по которым билдер показывает имя XML-атрибута, сейчас заводит только сид, и у большинства свойств их нет.

Данные для этого готовы. Измерения по свежему файлу меты View (69 записей `declare-styleable`, 1085 параметров) показали, что по тем же правилам, что у Compose, получается 64 логических компонента (все уже есть в базе), 1152 уникальных свойства, все типы входят в `property_type`, а типы общих свойств Compose и View **не расходятся ни в одной из 793 пар** (после правок генератора View для `android:orientation` и `Spinner.angle`). Значит, результат импорта двух платформ не зависит от порядка.

## What Changes

- **frontend-kt**: `components import-api` поддерживает платформу `android-view`. Делегат `android` для `API_META` запускает Gradle-задачу `readUikitApiMeta` плагина `dsBuilder`; CLI читает `build/theme-builder/components/uikit-api-meta.json`.
- **frontend-kt**: нормализатор меты View в тот же манифест, что у Compose. Правила: `componentNames[]` разворачивается в несколько компонентов; записи одного компонента сливаются по `(компонент, id)`; параметры типа `unknown` и записи `subStyle` пропускаются; состояния берутся из `stateSets`; платформенные имена берутся из `attrName`.
- **frontend-kt**: результат нормализации несёт список пропущенных элементов, и команда печатает их одной сводкой («Skipped: 55 params of type unknown, 20 params of sub-style records»).
- **frontend-kt + js/db-service**: у свойства в манифесте появляется список платформенных имён `platformNames`. У четырёх свойств View несколько XML-атрибутов (`Avatar.width` → `android:minWidth` и `android:maxWidth`, `Avatar.height`, `Spinner.size`, `ProgressBar.indicatorHeight`), и единственное имя теряло бы часть. Ручка по-прежнему принимает прежнее поле `platformName`, чтобы уже выпущенные CLI не сломались.
- **Проверка**: сверка результата импорта Compose и View на сиде в обоих порядках; это условие приёмки, поставленное ещё при проектировании `import-api`.

Не входит: платформы `swiftui` и `react`; поле `values` (допустимые значения `value`-свойств); `defaultValue`, `identity`, `sharedStates` и `stateValues`; свойства из `subStyle`-записей (вторая семья стилей внутри компонента); изменение схемы БД и миграции.

## Capabilities

### New Capabilities
Нет.

### Modified Capabilities
- `cli-components`: платформа `android-view` в `import-api`, получение меты View из артефакта, нормализация меты View, сводка пропущенного в отчёте.
- `platform-android-delegate`: `API_META` для `android-view` вместо отказа `Unsupported`.
- `component-api-meta-import`: список платформенных имён свойства в манифесте и аддитивное создание нескольких алиасов.

## Impact

- **frontend-kt**: `platform-android` (карта задач `AndroidGradleDelegate`), `feature-components` (нормализатор View, выбор нормализатора по платформе, имя файла меты, модель манифеста и результата нормализации, HTTP-адаптер), `cli` (печать сводки пропущенного), тесты во всех этих модулях и документация `cli/USAGE.md`.
- **js/db-service**: схема манифеста `apiMetaManifest.ts`, запись алиасов в `apiMetaImport.ts`, описание в `openapi/spec.ts` и регенерация типов админки (`/sync-api-types`), тесты `vitest`. Миграции не нужны: уникальный индекс `ppp_property_id_platform_name_unique` уже допускает несколько имён у одного свойства.
- **backend-kt**: не затрагивается.
- **Конфигурация**: новых переменных окружения нет. Нужна рабочая копия View-проекта с применённым плагином `dsBuilder` и секцией `components`, как для `components generate`.
- **Зависимость от plasma-android**: правка генератора View (`android:orientation`, `Spinner.angle`) не обязательна для работы, но без неё в отчёте появятся расхождения типа этих параметров с Compose.
