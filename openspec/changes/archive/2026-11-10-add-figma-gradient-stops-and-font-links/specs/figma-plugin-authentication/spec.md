## MODIFIED Requirements

### Requirement: Адреса сервера заданы в сборке

Плагин SHALL обращаться к боевому gateway, а сборка для разработки — к локальному. Кроме gateway плагин SHALL скачивать только файлы шрифтов с CDN `https://cdn-app.sberdevices.ru`, без токена. Адреса SHALL быть перечислены в `networkAccess` манифеста: боевой gateway и CDN шрифтов в `allowedDomains`, локальный gateway в `devAllowedDomains`.

#### Scenario: Сборка для публикации

- **WHEN** собирается плагин для публикации
- **THEN** манифест и код MUST NOT содержать разрешения на произвольные домены (`*`)

#### Scenario: Файл шрифта

- **WHEN** окно скачивает файл шрифта по ссылке из токена `fontFamily`
- **THEN** запрос MUST идти через общее Kotlin-ядро без заголовка `Authorization`, и ссылка не по `https` MUST отклоняться
