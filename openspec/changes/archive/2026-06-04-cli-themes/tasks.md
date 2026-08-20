## 1. Core config

- [x] 1.1 Расширить `ProjectConfig` optional полем `tenants` с default `emptyList`.
- [x] 1.2 Добавить serializable config-модель tenant metadata с полями `id`, `designSystemId`, `name`, `description`, `createdAt`, `updatedAt`.
- [x] 1.3 Обновить `ProjectConfigCodec`, чтобы config без `tenants` оставался валидным, а raw `apiKey` и `apiUrl` по-прежнему не сериализовались.
- [x] 1.4 Добавить в `ProjectConfigStore` или отдельный adapter безопасное обновление `.sdds/config.json` с сохранением `projectId`, `designSystemId` и `credential`.

## 2. Theme domain and application

- [x] 2.1 Создать package `com.dsbuilder.frontend.cli.feature.theme` со слоями `domain`, `application`, `data`, `presentation`, `di`.
- [x] 2.2 Добавить domain-модели `Tenant`, `Token`, `TokenValue`, `Platform`, token type/value models и user-facing error/result models.
- [x] 2.3 Реализовать deterministic normalizer tenant directory names с fallback на `tenant.id` и collision suffix из первых 8 символов `tenant.id`.
- [x] 2.4 Реализовать token value normalization для `color`, `gradient`, `typography`, `shadow`, `shape`, `fontFamily`.
- [x] 2.5 Реализовать grouping token values по `tenant -> platform -> token.type -> token.name`, игнорируя values без meta token.
- [x] 2.6 Реализовать validation, которая фейлится при missing value для enabled meta token и при invalid `TokenValue.value` shape.
- [x] 2.7 Добавить `FetchThemesUseCase`, который сначала загружает и валидирует все remote data, а затем выполняет local writes без intentional partial success.
- [x] 2.8 Добавить application ports для чтения project context, resolution API key/API URL, загрузки remote theme data и записи local theme files/config.

## 3. Theme data adapters

- [x] 3.1 Реализовать HTTP adapter для `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}/tenants`.
- [x] 3.2 Реализовать HTTP adapter для `GET /api/projects/{projectId}/ds/design-systems/{designSystemId}/tokens`.
- [x] 3.3 Реализовать HTTP adapter для `GET /api/projects/{projectId}/ds/tenants/{tenantId}/token-values`.
- [x] 3.4 Добавить explicit DTO-модели для `Tenant`, `Token` и `TokenValue` responses и mapping DTO в domain.
- [x] 3.5 Реализовать parse failure mapping в deterministic CLI failure output без raw API key.
- [x] 3.6 Реализовать local writer для `.sdds/{tenantDirectory}/meta.json`.
- [x] 3.7 Реализовать local writer для `.sdds/{tenantDirectory}/{platform}/{platform}_{type}.json` с полным overwrite known generated files.
- [x] 3.8 Реализовать local config writer, который сохраняет downloaded tenants в `.sdds/config.json`.

## 4. Presentation and DI

- [x] 4.1 Добавить `ThemeCliCommand` как command group `theme`.
- [x] 4.2 Добавить `ThemeFetchCliCommand` с options `--api-key` и `--api-url`.
- [x] 4.3 Подключить `theme fetch` к `FetchThemesUseCase` и mapping result в deterministic stdout/exit code.
- [x] 4.4 Добавить `ThemeFeatureModule` с wiring application ports, data adapters и presentation commands.
- [x] 4.5 Обновить root CLI module, чтобы `dsbuilder --help` показывал `theme`, а `dsbuilder theme --help` показывал `fetch`.

## 5. Tests

- [x] 5.1 Добавить tests для `ProjectConfigCodec`: config без `tenants`, config с `tenants`, отсутствие raw `apiKey` и `apiUrl`.
- [x] 5.2 Добавить tests для tenant directory normalization, включая slash/space symbols, empty normalized name и collision.
- [x] 5.3 Добавить tests для token value normalization по всем supported token types.
- [x] 5.4 Добавить tests для grouping: known token values попадают в platform/type files, unknown token values ignored, `mode` не влияет на layout.
- [x] 5.5 Добавить tests для missing enabled token value и invalid value shape failures без записи partial files.
- [x] 5.6 Добавить tests для HTTP adapter paths и parse failure mapping через fake `AuthenticatedHttpClientFactory`.
- [x] 5.7 Добавить tests для local writer output: `meta.json`, `android/android_typography.json`, `ios/ios_color.json`, `web/web_color.json` и config `tenants`.
- [x] 5.8 Добавить CLI tests для `dsbuilder --help`, `dsbuilder theme --help`, successful `theme fetch`, backend failure и credential missing failure.
- [x] 5.9 Проверить, что CLI tests не печатают raw API key и не требуют backend services, Docker, credentials или private URLs для help/version.

## 6. Verification

- [x] 6.1 Запустить `cd dsbuilder-frontend && ./gradlew test`.
- [x] 6.2 Запустить `cd dsbuilder-frontend && ./gradlew detekt`.
- [x] 6.3 Запустить `cd dsbuilder-frontend && ./gradlew spotlessCheck`.
- [x] 6.4 Если `spotlessCheck` падает только из-за форматирования измененных файлов, запустить `cd dsbuilder-frontend && ./gradlew spotlessApply` и повторить checks.
- [x] 6.5 Запустить `cd dsbuilder-frontend && ./gradlew build`.
