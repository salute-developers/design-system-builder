## ADDED Requirements

### Requirement: CORS для Figma-плагина

Публичный вход `backend-kt/app` SHALL разрешать origin из настройки `OIDC_PLUGIN_ORIGINS` (значение для Figma — `null`) только для `POST` на endpoint устройства Keycloak, `/auth/token` и `/auth/logout` и для `GET` на `/api/projects` и `/api/projects/**`. Настройка SHALL быть необязательной; без неё поведение CORS MUST NOT меняться. Gateway MUST NOT возвращать `Access-Control-Allow-Credentials` для такого origin. Авторизация запросов MUST NOT зависеть от origin.

#### Scenario: Чтение из плагина

- **WHEN** запрос `GET /api/projects/{id}/ds/design-systems` приходит с `Origin: null`, а origin разрешён настройкой
- **THEN** ответ и его preflight MUST содержать `Access-Control-Allow-Origin: null` и `Vary: Origin`
- **THEN** `Access-Control-Allow-Methods` MUST NOT содержать методы записи, иначе браузер закэширует их на этот адрес

#### Scenario: Запись из плагина

- **WHEN** запрос `PATCH` или preflight `PATCH` на `/api/projects/**` приходит с `Origin: null`
- **THEN** Gateway MUST NOT возвращать разрешающий CORS-ответ

#### Scenario: Настройка не задана

- **WHEN** `OIDC_PLUGIN_ORIGINS` не задана, а запрос приходит с `Origin: null`
- **THEN** Gateway MUST NOT возвращать `Access-Control-Allow-Origin`

#### Scenario: Запрос без токена

- **WHEN** разрешённый origin отправляет запрос к `/api/projects` без `Authorization`
- **THEN** Gateway MUST вернуть `401`, как и для любого другого origin
