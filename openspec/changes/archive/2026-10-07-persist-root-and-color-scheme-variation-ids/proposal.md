## Why

Common-конфиг компонента несёт два указателя на оси: `rootVariationId` и `colorSchemeVariationId`. Сейчас `ds-service` хранит только вторую роль (флаг `appearance_variations.is_color_scheme`), а `rootVariationId` при заливке читает и выбрасывает. Выгрузка восстанавливает корень по имени оси `size`. Конфиг, где корнем объявлена другая ось, не переживает круг «заливка → выгрузка»: корень теряется или подменяется осью `size`. Роль цветовой схемы при этом лежит флагом на связи, и инвариант «ось одна на appearance» нигде не закреплён.

## What Changes

- Обе роли хранятся на `appearances` двумя колонками: `root_variation_id` и `color_scheme_variation_id`. Обе ссылаются на ось, объявленную у этого же appearance (составной внешний ключ), поэтому «не больше одной оси на роль» и «ось принадлежит appearance» гарантирует сама схема.
- Миграция Flyway переносит `is_color_scheme` в `color_scheme_variation_id` и проставляет `root_variation_id` существующим appearance по правилу фолбэка (см. ниже).
- Заливка `component-config` сохраняет `rootVariationId` и `colorSchemeVariationId` из запроса. Если `rootVariationId` в конфиге не указан, корень выбирается так: ось с именем `size`; если её нет, первая по `position` ось, кроме оси цветовой схемы; если осей нет, корня нет.
- Выгрузка и чтение `component-config` отдают сохранённые значения, а не выводят их по имени.
- CRUD `appearance-variations` принимает и возвращает роли осей; назначение роли одной оси снимает её с другой; удаление оси, несущей роль, снимает роль, а корень пересчитывается по тому же правилу фолбэка.
- OpenAPI-контракт `ds-service` и `contracts/` обновляются под новые поля.
- **BREAKING** (внутри `ds-service`): `isColorScheme` в запросах и ответах `appearance-variations` остаётся ради совместимости, но становится производным от `color_scheme_variation_id`; новое поле `isRoot` добавляется рядом.
- Колонка `is_color_scheme` не удаляется: `db-service` остаётся откатной веткой HTTP и читает её. До вывода `db-service` из эксплуатации `ds-service` пишет её синхронно с новой колонкой.

- Клиент `frontend-kt` выбирает `rootVariationId` при разборе native-конфигурации по тому же правилу, что и сервис: среди осей, кроме оси цветовой схемы, ось `size`, иначе первая по порядку объявления. Раньше `ConfigCodec.decode` брал первую ось `bindings` независимо от имени и роли, а так как `ds-service` теперь сохраняет присланный корень, это изменило бы результат `components fetch`.

Вне скоупа: `js/db-service` (код и drizzle-схема не меняются).

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `component-appearance-model`: роль цветовой схемы хранится как ссылка на ось на уровне appearance, а не флаг на связи; добавляется хранимая роль корневой оси, правило фолбэка и поведение при удалении оси с ролью.

- `component-config-codec`: корневая ось в common-конфигурации выбирается по `size`, затем по первой оси, не являющейся осью цветовой схемы.

## Impact

- `backend-kt/ds-service/feature-components`: `ComponentTables.kt`, `ComponentConfigImporter.kt`, `ComponentConfigBuilder.kt`, `ExposedAppearanceRepository.kt`, `AppearanceRepository.kt`, доменные модели и DTO `appearance-variations`, `ComponentConfigResponse.kt`, `ImportComponentConfigRequest.kt`.
- `backend-kt/ds-service/app`: новая миграция Flyway (`V3__…`) и обновление `contracts/schema-fingerprint.json`, которым проверяется схема при adoption.
- `backend-kt/ds-service/contracts`: описание API.
- `frontend-kt/feature-components`: `ConfigCodec.decode` и `ConfigCodecTest`.
- `openspec/specs`: дельты `component-appearance-model` и `component-config-codec`.
- `js` не меняется; форма полей конфига остаётся прежней.
