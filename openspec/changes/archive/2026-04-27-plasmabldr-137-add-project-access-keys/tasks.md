## 1. Persistence and domain

- [x] 1.1 Добавить domain-модель ProjectAccessKey, AccessKeyScope и lifecycle states
- [x] 1.2 Добавить persistence table/entity для project_access_keys
- [x] 1.3 Реализовать secret generation и hash verification без хранения raw secret
- [x] 1.4 Добавить configuration для key prefix, expiration defaults и hashing parameters

## 2. Projects Service API

- [x] 2.1 Реализовать use case создания key с one-time raw secret response
- [x] 2.2 Реализовать use case list keys без raw secret
- [x] 2.3 Реализовать use case revoke key
- [x] 2.4 Реализовать internal use case для key verification
- [x] 2.5 Реализовать DTO, mappers и Ktor routes для access key endpoints

## 3. Gateway/Auth Helper integration

- [x] 3.1 Расширить Auth Helper detection для JWT vs project access key
- [x] 3.2 Добавить вызов internal key verification endpoint в Projects Service
- [x] 3.3 Добавить trusted headers для `project_key` actor
- [x] 3.4 Обновить nginx Gateway routing/header forwarding для project key context

## 4. Tests and verification

- [x] 4.1 Добавить unit tests для secret hashing, scope policy и revoke behavior
- [x] 4.2 Добавить repository/local source tests для hash-only storage и revoked keys
- [x] 4.3 Добавить Ktor route tests для create/list/revoke/verify endpoints
- [x] 4.4 Добавить Gateway/Auth Helper tests для project key actor context
- [x] 4.5 Запустить relevant Gradle `build`, `detekt`, `spotlessCheck` и tests
- [x] 4.6 Если `spotlessCheck` падает только на измененных файлах, запустить `spotlessApply`, проверить diff и повторить checks
