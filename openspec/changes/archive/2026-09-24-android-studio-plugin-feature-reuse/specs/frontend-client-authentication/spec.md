## ADDED Requirements

### Requirement: Authorization Code + PKCE как альтернативный способ получить user session

`feature-auth` SHALL предоставлять Authorization Code + PKCE через системный браузер как второй, не заменяющий существующий Direct Access Grant, способ получить пользовательскую сессию (`UserOAuthTokens`) для клиентов с интерактивным UI (например `:plugins:android-studio`).

#### Scenario: Клиент запускает PKCE-флоу

- **WHEN** клиентское приложение вызывает OAuth use case из `feature-auth`
- **THEN** use case генерирует PKCE-пару и `state` через `PkceGenerator` из `core-auth`
- **THEN** use case строит authorize URL и открывает его через предоставленную клиентом реализацию порта `BrowserLauncher`
- **THEN** use case дожидается OAuth redirect через предоставленную клиентом реализацию порта `RedirectListener`

#### Scenario: Полученные токены применяются через общий resolver

- **WHEN** authorization code успешно обменян на токены через `TokenExchangeClient`
- **THEN** use case применяет `UserOAuthTokens` через `UserSessionCredentialResolver` из `core-auth`, используя тот же resolver, что и Direct Access Grant флоу
- **THEN** refresh token сохраняется через предоставленную клиентом реализацию порта `RefreshTokenStore`, а не через файловый `CredentialStore`, используемый `auth login`

#### Scenario: Тихий refresh на 401 переиспользует общий примитив

- **WHEN** authenticated HTTP-запрос клиента завершается `401` и в `RefreshTokenStore` есть сохранённый refresh token
- **THEN** use case тихого refresh из `feature-auth` обменивает его через `TokenExchangeClient.refresh`
- **THEN** при неудаче use case очищает сессию через `UserSessionCredentialResolver.clear()`, не завершаясь исключением наружу

#### Scenario: PKCE-флоу не требует username/password UI

- **WHEN** клиент использует Authorization Code + PKCE как способ авторизации
- **THEN** клиент MUST NOT запрашивать логин или пароль в собственном UI
- **THEN** ввод учётных данных происходит только в системном браузере пользователя
