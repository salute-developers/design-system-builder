## ADDED Requirements

### Requirement: Фильтр платформ в значениях темы

`GET /tenants/{id}/token-values` SHALL принимать необязательный параметр `platforms` со списком `web`, `ios`, `android` через запятую и отдавать значения только этих платформ, вместе с фильтром `types`. Без параметра SHALL отдаваться значения всех платформ; с параметром значения без платформы MUST NOT отдаваться. Пустой элемент, неизвестная или повторённая платформа MUST давать отказ `400` с кодом `invalid_platforms`.

#### Scenario: Значения двух платформ

- **WHEN** клиент запрашивает `token-values?types=color&platforms=ios,web`
- **THEN** ответ MUST содержать значения цветов платформ `ios` и `web` и MUST NOT содержать значения `android`

#### Scenario: Неизвестная платформа

- **WHEN** клиент запрашивает `token-values?platforms=windows`
- **THEN** ответ MUST быть `400` с кодом `invalid_platforms`
