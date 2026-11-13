# local-base-bootstrap Specification

## Purpose
Определяет наполнение локального контура дизайн-системой `base` через Gateway скриптом `backend-kt/bootstrap-base.sh`.

## Requirements

### Requirement: Локальный контур запускается из PowerShell на Windows

Система SHALL предоставлять setup-local.ps1 для Windows с Docker Desktop без Bash/WSL/JDK/Node на хосте, с тем же контрактом наполнения, что setup-local.sh.

#### Scenario: Первый запуск

- **WHEN** пользователь запускает Bash или PowerShell setup без явного пакета компонентов
- **THEN** setup MUST поднять backend и клиент, подготовить проект и глобальный Web API и при наличии архива опубликовать Compose-плагин с его API
- **AND** setup MUST NOT создавать демонстрационные ДС/темы или импортировать их значения и конфигурации

#### Scenario: Демонстрационный импорт по запросу

- **WHEN** задан --components-package/-ComponentsPackage либо COMPOSE_COMPONENTS_PACKAGE
- **THEN** setup MUST вызвать существующий seed-local-design-system.sh для явного демонстрационного импорта
- **AND** --skip-design-system/-SkipDesignSystem MUST подавлять этот шаг независимо от источника пакета
- **AND** --theme-package/-ThemePackage без явного пакета компонентов MUST приводить к ошибке до запуска контура, если импорт не отключён

#### Scenario: Повторный запуск и остановка

- **WHEN** setup повторён без --reset/-Reset
- **THEN** volumes и существующие пользовательские данные MUST сохраняться
- **WHEN** пользователь явно передал --reset/-Reset
- **THEN** setup MUST пересоздать volumes перед запуском
- **WHEN** пользователь передал --down/-Down
- **THEN** setup MUST остановить контур без удаления volumes

#### Scenario: Необязательные локальные пакеты

- **WHEN** встроенный Compose-плагин отсутствует или не публикуется
- **THEN** setup MUST продолжить запуск с диагностикой
- **WHEN** явно заданный архив плагина или включённый пакет компонентов не загружается
- **THEN** setup MUST завершиться ошибкой

### Requirement: Local bootstrap prepares API without demo data

Скрипт `backend-kt/bootstrap-base.sh` SHALL готовить проект пользователя и глобальный Web API только через Gateway, без прямого доступа к БД и без создания пользовательской ДС, темы, импорта значений токенов или конфигураций компонентов.

#### Scenario: Пустой локальный контур

- **WHEN** схема готова и bootstrap запущен с доступным Gateway
- **THEN** скрипт MUST найти или создать проект пользователя и импортировать глобальный Web API из web-api-meta.json
- **AND** скрипт MUST NOT создавать base/base_default или другие пользовательские ДС и темы

#### Scenario: Повторный запуск

- **WHEN** проект и пользовательские ДС уже существуют
- **THEN** bootstrap MUST переиспользовать проект, обновить глобальный API и не импортировать значения или конфигурации в пользовательские ДС
- **AND** существующие данные и журналы MUST сохраняться

#### Scenario: Отсутствует источник API

- **WHEN** web-api-meta.json отсутствует и не может быть сгенерирован
- **THEN** bootstrap MUST остановиться до изменений в контуре с диагностикой
