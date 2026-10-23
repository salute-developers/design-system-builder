# local-base-bootstrap Specification

## Purpose
Определяет наполнение локального контура дизайн-системой `base` через Gateway скриптом `backend-kt/bootstrap-base.sh`.
## Requirements
### Requirement: Local base bootstrap fills the contour through the gateway

Скрипт `backend-kt/bootstrap-base.sh` SHALL наполнять локальный контур дизайн-системой `base` только через Gateway (`/api/projects`, `/api/projects/{id}/ds/*`, `/api/admin/component-config/import-api-meta` через `dsbuilder components import-api`), без обращения к базе напрямую и без db-service.

#### Scenario: Пустая база после Flyway

- **WHEN** `ds-service` создал схему в пустой `ds_registry` и скрипт запущен с доступным Gateway
- **THEN** скрипт MUST найти или создать проект пользователя, залить глобальный слой web-компонентов из `web-api-meta.json`, создать дизайн-систему `base` с темой `base_default` в этом проекте; версию скрипт MUST NOT публиковать — `base` остаётся черновиком
- **AND** после скрипта `POST .../component-config/export` для `base` MUST возвращать компоненты, а у темы `base_default` MUST быть значения токенов

#### Scenario: Порядок глобального слоя и темы

- **WHEN** скрипт создаёт дизайн-систему `base`
- **THEN** импорт глобального слоя MUST завершиться до создания темы `base_default`, потому что компоненты темы инициализируются ds-service только при полном глобальном слое

#### Scenario: Повторный запуск

- **WHEN** скрипт запущен повторно на контуре, где проект, `base` и `base_default` уже есть
- **THEN** скрипт MUST завершиться успешно, не создавая второй проект, дизайн-систему или тему

#### Scenario: Компоненты не завелись

- **WHEN** после создания темы экспорт `base` возвращает пустой список компонентов
- **THEN** скрипт MUST завершиться с ошибкой, называющей глобальный слой web-компонентов как причину

#### Scenario: Нет меты или CLI

- **WHEN** `web-api-meta.json` отсутствует и его нельзя сгенерировать, либо дистрибутив CLI нельзя собрать
- **THEN** скрипт MUST остановиться до изменений в контуре с командой, которую нужно выполнить

