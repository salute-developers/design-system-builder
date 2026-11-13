## 1. Импорт

- [x] 1.1 `TokenReferenceName.kt`: обратное правило — имя ссылки типографики без экрана → `screen-s.<имя>`; признак литерала (нет точки, `#…`, `rgb(…)`, `rgba(…)`)
- [x] 1.2 `ComponentConfigImporter.token`: учитывает тип значения; литерал не ищется и не попадает в `unresolvedTokens`; типографика без экрана привязывается к `screen-s`
- [x] 1.3 `GeneratedDesignSystemComponentInitializer`: корень appearance по `fallbackRoot` из объявленных осей (писатель сидов пакетный, `ensureRoot` здесь не видит записанных осей)
- [x] 1.5 `GeneratedDesignSystemComponentInitializer`: позиции значений как у импорта, числовое смещение из поправок — в `adjustment` (`PlatformParamOffsets.pick`)
- [x] 1.6 `component-seeds.json`: стили `Badge` строчными без дублей; `app/contracts/resources.sha256.json`
- [x] 1.7 `ExposedSizeTokenUsageRepository.adjustments`: при смещении в колонке значения имя параметра — из поправки с тем же смещением
- [x] 1.4 Unit-тесты правил имени: без экрана, с экраном, не-типографика, литералы

## 2. Симметричность

- [x] 2.1 HTTP-тест на Postgres: дизайн-система из сидов → `component-config/export` → пробный импорт того же пакета → `updated = 0`, `created = 0`, пустые `unresolvedTokens`
- [x] 2.2 Тест создания дизайн-системы: выгрузка компонента с осью `size` содержит `rootVariationId: "size"`
- [x] 2.3 Тест импорта: `transparent` сохраняется литералом и не попадает в отчёт; `body.l.bold` привязан к `screen-s.body.l.bold`

## 3. Локальные проверки

- [x] 3.1 `JAVA_TOOL_OPTIONS=-Dapi.version=1.44 TESTCONTAINERS_RYUK_DISABLED=true ./gradlew :ds-service:buildAll :architecture-tests:test` в `backend-kt`
- [x] 3.2 Локальный контур: на `base` (создана до исправления) `push --apply` своей выгрузки, затем повторные `fetch` и пробный `push` — `Updated: 0`, ненайденных токенов нет
- [x] 3.3 `openspec validate fix-component-config-roundtrip --strict`

## 4. Проверки до архивирования

- [ ] 4.1 [внешняя проверка] DEV, дизайн-система `base` проекта Neretin, после выкладки ds-service: `push --apply` выгрузки без значений 21 свойства без web-параметра (план затрагивает только выравнивание и эти значения); повторная выгрузка и пробный `push` — `Updated: 0`; превью Button, IconButton, Checkbox и Radiobox открывается
