## 1. Canonical authorization policy

- [ ] 1.1 Добавить `authorization/policy.json` с `schemaVersion`, `policyVersion`, каталогом permissions, наследованием/grants ролей, допустимыми project-key scopes и `system_admin` override; перенести существующие scopes Projects Service и добавить `documentation:read`/`documentation:write`.
- [ ] 1.2 Добавить JSON Schema и проверки неизвестных permissions, ролей, scopes, duplicate grants и циклического inheritance graph.
- [ ] 1.3 Добавить language-neutral conformance fixtures для Viewer, Editor, Maintainer, Owner, `system_admin` и project key с полным/неполным набором scopes.
- [ ] 1.4 Сверить grants Projects Service с действующими ADR/specs и зафиксировать расхождения `Roles.md` так, чтобы migration не меняла существующее поведение project/member/access-key API.

## 2. Общий Kotlin evaluator

- [ ] 2.1 Создать минимальный reusable Gradle module/build authorization core без Ktor, Exposed и service-specific dependencies и подключить его к root composite build.
- [ ] 2.2 Реализовать модели policy, immutable file loader, schema/semantic validation, вычисление effective grants и точную проверку project-key scopes.
- [ ] 2.3 Реализовать fail-closed startup contract и безопасную диагностику `policyVersion`/content hash без permissive fallback.
- [ ] 2.4 Покрыть loader, inheritance, invalid policy, user grants, project-key scopes и `system_admin` override unit-тестами на общих conformance fixtures.

## 3. Projects Service migration

- [ ] 3.1 Подключить authorization core и file-backed policy через DI, сохранив presentation -> application -> domain границы.
- [ ] 3.2 Заменить `projects.accessKeys.availableScopes` на каталог project-key scopes canonical policy и удалить локальное дублирование configuration.
- [ ] 3.3 Адаптировать role/permission проверки Projects Service к общему evaluator, сохранив в application policy ресурсные инварианты Owner, member management, archived project и запреты для project key.
- [ ] 3.4 Добавить тесты создания key с `documentation:read`/`documentation:write`, отклонения неизвестного scope и сохранения точного набора scopes.
- [ ] 3.5 Прогнать regression tests project/member/access-key endpoints и подтвердить отсутствие изменений существующих разрешений Viewer, Editor, Maintainer, Owner и `system_admin`.

## 4. Documentation Service enforcement

- [ ] 4.1 Подключить authorization core и canonical policy через DI и преобразовывать trusted headers в единый `ProjectPrincipal` на presentation boundary.
- [ ] 4.2 Заменить локальный список publishing roles в ingestion application policy на permission `documentation:write`.
- [ ] 4.3 Проверять `documentation:write` до чтения multipart body и любых storage/database side effects; добавить route tests для user roles, `system_admin`, project key со scope и project key без scope.
- [ ] 4.4 Добавить `documentation:read` ко всем ingestion-job, publication, navigation, page, binding и asset read routes, не изменяя существующие project ownership repository filters.
- [ ] 4.5 Добавить `documentation:read` к search и `kb/fetch`, не выполняя repository query при недостаточном permission.
- [ ] 4.6 Добавить tests, различающие `403 Forbidden` при недостаточном permission и `404 Not Found` для resource другого trusted project.
- [ ] 4.7 Проверить, что invalid/missing trusted context отклоняется fail-closed и client-provided headers не создают обход Gateway contract.

## 5. Packaging и rollout

- [ ] 5.1 Включить один canonical policy artifact в Projects Service и Documentation Service images и добавить configurable read-only policy path для local/production runtime.
- [ ] 5.2 Обновить Docker Compose/local configuration и readiness так, чтобы отсутствующая или invalid policy делала сервис неготовым.
- [ ] 5.3 Добавить migration/release инструкцию по перевыпуску используемых CLI/MCP project keys с минимальными `documentation:read` и/или `documentation:write`; существующим keys scopes автоматически не расширять.
- [ ] 5.4 Проверить порядок rollout: Projects Service принимает новые scopes до включения enforcement Documentation Service; описать rollback Documentation Service без отката persistence.

## 6. Verification

- [ ] 6.1 Выполнить unit/conformance tests authorization core и проверить canonical policy против JSON Schema.
- [ ] 6.2 Выполнить `cd backend-kt/projects-service && ./gradlew test detekt spotlessCheck build`.
- [ ] 6.3 Выполнить `cd backend-kt/documentation-service && ./gradlew test detekt spotlessCheck build`.
- [ ] 6.4 Выполнить `cd backend-kt && ./gradlew build` для проверки composite integration.
- [ ] 6.5 В local contour проверить Viewer/Editor/Owner, `system_admin`, project key с read-only scope, project key с write scope, key без documentation scopes и foreign-project resource.
- [ ] 6.6 Проверить, что `db-service`, `generator`, `documentation-generator`, `publisher` и `project-publisher` не изменены этим change.
