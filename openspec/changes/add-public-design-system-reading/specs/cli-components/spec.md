## MODIFIED Requirements

### Requirement: CLI components fetch command

CLI `dsbuilder` SHALL предоставлять проектную команду `components fetch` для загрузки конфигураций компонентов дизайн-системы с сервера DS Builder в локальный пакет компонентов с выбранным режимом доступа.

#### Scenario: Components fetch использует project-scoped context

- **WHEN** разработчик запускает `dsbuilder components fetch` в каталоге настроенного проекта
- **THEN** CLI MUST разрешить ближайшую `.sdds/config.json`
- **THEN** CLI MUST разрешить режим доступа через общую логику CLI
- **THEN** CLI MUST использовать `projectId` и `designSystemId` из конфигурации для запроса
- **THEN** CLI MUST отправить выбранный PAT или OAuth через Bearer либо выполнить разрешённое анонимное чтение без `Authorization`
- **THEN** CLI MUST NOT выводить секретные учётные данные

#### Scenario: Components fetch help не требует project config

- **WHEN** разработчик запускает `dsbuilder components fetch --help`
- **THEN** CLI MUST показать однозначную справку
- **THEN** CLI MUST NOT требовать `.sdds/config.json`, сервер, учётные данные или закрытый URL

#### Scenario: Fetch печатает resolved source перед записью

- **WHEN** `dsbuilder components fetch` получил пакет от сервера
- **THEN** CLI MUST вывести разрешённый API URL сервера и источник этого URL
- **THEN** CLI MUST вывести `projectId` и `designSystemId`, использованные для запроса
- **THEN** CLI MUST вывести имя пакета, его версию и число конфигураций
- **THEN** CLI MUST вывести целевой каталог
- **THEN** CLI MUST NOT выводить секретные учётные данные


## ADDED Requirements

### Requirement: Публичный экспорт одной опубликованной версии
`components fetch` SHALL допускать анонимную загрузку явно выбранной публичной ДС. Экспорт и web-адаптер MUST использовать одну фактическую опубликованную границу через существующие POST-маршруты.

#### Scenario: Согласованный пакет React
- **WHEN** гость загружает пакет React, а после разрешения версии появляется новая публикация
- **THEN** экспорт и web-адаптер MUST передавать один закреплённый `versionId`
- **THEN** данные пакета MUST NOT содержать изменения черновика или другой публикации

#### Scenario: Отказ вспомогательного чтения
- **WHEN** экспорт успешен, но web-адаптер недоступен после отзыва публичности
- **THEN** CLI MUST завершиться ошибкой без записи неполного пакета

#### Scenario: PAT только на чтение компонентов
- **WHEN** участник использует PAT с `components:read`, без `design-systems:read`, и имеет необходимые права на систему
- **THEN** `components fetch` MUST начать с разрешённого экспорта и сохранить успешное чтение черновика либо явно выбранной публикации
- **THEN** web-адаптер MUST использовать публикацию, закреплённую по экспорту, либо селектор `draft`, если экспорт прочитал черновик
- **THEN** команда MUST NOT запрашивать карточку ДС для выбора версии
