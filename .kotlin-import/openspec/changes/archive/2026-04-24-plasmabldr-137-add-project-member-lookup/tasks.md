## 1. Application contract

- [x] 1.1 Добавить identity lookup port для поиска пользователя по email
- [x] 1.2 Описать application result/error для registered user not found
- [x] 1.3 Обновить add-member use case на email-based input с сохранением membership по `userId`

## 2. Keycloak adapter

- [x] 2.1 Добавить configuration для Keycloak Admin API base URL, realm, client id и secret
- [x] 2.2 Реализовать data adapter для read-only lookup пользователя по email
- [x] 2.3 Замаппить Keycloak errors в application-level errors
- [x] 2.4 Убедиться, что Keycloak SDK/types не протекают в domain/application

## 3. Presentation

- [x] 3.1 Обновить add-member request DTO на `email` и `role`
- [x] 3.2 Обновить response/error DTO для user-not-found сценария
- [x] 3.3 Обновить Ktor route и mapper для добавления member по email

## 4. Tests and verification

- [x] 4.1 Добавить use case tests для successful lookup и missing user
- [x] 4.2 Добавить adapter tests для Keycloak lookup и error mapping
- [x] 4.3 Добавить Ktor route tests для add-member by email
- [x] 4.4 Запустить relevant Gradle `build`, `detekt`, `spotlessCheck` и tests
- [x] 4.5 Если `spotlessCheck` падает только на измененных файлах, запустить `spotlessApply`, проверить diff и повторить checks
