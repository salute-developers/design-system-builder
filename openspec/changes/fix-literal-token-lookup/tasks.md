## 1. Импорт

- [ ] 1.1 `TokenReferenceName.isLiteralValue`: явный список литералов CSS вместо признака «нет точки»
- [ ] 1.2 `ComponentConfigImporter`: `tokenName` не отбрасывает литералы; `token` пишет в `unresolvedTokens` только ненайденное значение, которое не литерал
- [ ] 1.3 Unit-тесты: `card`, `elevated` — не литералы; `none`, `currentColor`, `hsl(…)` — литералы

## 2. Проверки

- [ ] 2.1 `ComponentConfigRoundTripHttpPostgresIntegrationTest` и тесты `feature-components` проходят
- [ ] 2.2 `./gradlew :ds-service:buildAll` в `backend-kt`
