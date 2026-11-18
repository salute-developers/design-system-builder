## 1. Сиды

- [x] 1.1 `component-seeds.json`: у `Skeleton` привязка `gradientColor` → `view` в `propertyVariations` и значение `{"prop": "gradientColor", "token": "surface.default.skeleton-gradient"}` в `view.default`
- [x] 1.2 Проверить, что свойство `gradientColor` есть в глобальном web-слое `Skeleton` (web-мета) и что ассемблер клиента принимает градиентный токен для свойства типа `color`; при отказе — остановиться и обсудить
- [x] 1.3 Тесты ds-service на сиды проходят; при наличии теста состава свойств — обновить

## 2. Локальные проверки

- [x] 2.1 `JAVA_TOOL_OPTIONS=-Dapi.version=1.44 TESTCONTAINERS_RYUK_DISABLED=true ./gradlew :ds-service:buildAll :architecture-tests:test` в `backend-kt`
- [x] 2.2 Новая дизайн-система на локальном контуре: web-превью `Skeleton` с анимацией `shimmer` видно (скриншот)
- [x] 2.3 `openspec validate add-skeleton-gradient-color --strict`

## 3. Проверки до архивирования

- [ ] 3.1 [внешняя проверка] На DEV `Skeleton` в используемых дизайн-системах обновлён `dsbuilder components push` пакета из `import:plasma` (`reimport-skeleton-from-core`), без ручных правок в редакторе; push выполняется после влития `fix-component-config-roundtrip`, отчёт без ненайденных токенов, превью `default` и `lighter` видно
