## ADDED Requirements

### Requirement: Web client does not show npm publication status

Веб-клиент SHALL NOT обращаться к npm registry и SHALL NOT показывать статус публикации npm-пакета
дизайн-системы, её версию, команду установки или ссылку на npm.

#### Scenario: Настройки дизайн-системы

- **WHEN** пользователь открывает настройки дизайн-системы
- **THEN** страница MUST NOT содержать блок публикации в npm
- **THEN** клиент MUST NOT отправлять запросы к `registry.npmjs.org`

#### Scenario: Старая ссылка на обзор темы

- **WHEN** пользователь переходит по ссылке `.../themes/{tenantId}/overview`
- **THEN** клиент MUST открыть раздел «Цвета» этой темы
