## Why

Конфигурации компонентов дизайн-систем сегодня живут в репозитории `salute-developers/theme-converter` в native-формате и попадают в платформенный код через Gradle-плагин `plugin_theme_builder`. В DS Builder их нет: чтобы компонент появился в продуктовой модели, его нужно завести руками через web-клиент. Для шести живых дизайн-систем это 500 конфигураций, которые никто не перенесёт вручную.

CLI `dsbuilder` уже умеет читать локальный контекст проекта, разрешать credentials и ходить в project-scoped API, но работает только на чтение. Команда `components push` замыкает контур: берёт native-конфигурации, преобразует их кодеком в common-формат DS Builder и загружает в backend одним запросом.

## What Changes

- Новая команда `dsbuilder components push` загружает конфигурации компонентов дизайн-системы в DS Builder.
- Источник native-конфигураций — локальная директория: `.sdds/components` по умолчанию либо заданная `--from`.
- Порт config codec из PR `salute-developers/plasma-android#386` в CLI как переиспользуемый модуль. Оба направления: `decode` (native -> common) для `push`, `encode` (common -> native) для будущего `components pull`.
- Модель данных codec переписывается под фактический формат конфигураций, а не под форму из PR: добавляются `bindings`, `binding`, `key`; поле `kind` из PR в реальных данных отсутствует.
- `meta.json` передаётся вместе с конфигурациями как неотделимая часть пакета. Идентичность компонента — пара (`componentName`, `styleName`).
- CLI печатает `meta.json.name`, источник пакета и число конфигураций рядом с целью запроса перед отправкой. Автоматическая сверка имени дизайн-системы не выполняется: сопоставимое поле на стороне backend не установлено.
- **BREAKING** для `cli-core`: `AuthenticatedHttpClient` перестаёт быть `fun interface` — добавляется метод `post`.
- Пишущие команды CLI обязаны получать backend API URL явно. Умолчание `DEFAULT_API_URL` для них запрещено.
- `components push` по умолчанию выполняет `--dry-run`; реальная запись требует явного `--apply`.

## Capabilities

### New Capabilities

- `cli-components`: команда `components push`, источники native-конфигураций, контракт `meta.json`, преобразование native -> common, барьеры на запись, отчёт о загрузке.
- `component-config-codec`: преобразование конфигурации компонента между native и common форматами в обе стороны, включая контракт входных данных и правила отказа.

### Modified Capabilities

- `cli-core`: HTTP-слой получает поддержку POST с телом запроса; резолв API URL получает режим, в котором умолчание запрещено для пишущих операций.
- `frontend-cli`: дерево команд пополняется `components` и `components push`.

## Impact

**Модули этого репозитория**

- `dsbuilder-frontend/cli` — новая feature `components` (`presentation`, `application`, `domain`, `data`, `di`), новый модуль или пакет для codec.
- `dsbuilder-frontend/cli/src/commonMain/.../core/http/AuthenticatedHttpClient.kt` — POST.
- `dsbuilder-frontend/cli/src/commonMain/.../core/http/ApiUrlResolver.kt` — запрет умолчания для записи.
- `dsbuilder-frontend/cli/src/commonMain/.../di/CliModule.kt` — регистрация команды.
- `dsbuilder-frontend/cli/build.gradle.kts` — при выделении codec в отдельный модуль.

**Внешние зависимости**

- `salute-developers/theme-converter` — источник native-конфигураций и схем `config_scheme.json` / `common_config_scheme.json`. Пакет доставляется в рабочую директорию вне CLI.
- Соседний репозиторий `design-system-builder`, сервис `db-service` — требуется новый транзакционный endpoint `components:import`, расширение `propertyTypeEnum`, разрешение типа `component_style` в граф зависимостей компонентов, уникальный индекс на `style_combinations`. Без этих доработок команда не может завершиться успешно. Контракт фиксируется в `design.md` этого change как требование к соседнему репозиторию.

**Безопасность**

- Первая пишущая операция CLI. Требует проверки write-scope `COMPONENTS` на стороне gateway и `db-service`.
- Существующее умолчание `DEFAULT_API_URL` указывает на публичный gateway, поэтому запрет умолчания для записи входит в объём изменения.

**Не входит в объём**

- Команда `components pull`. Направление `encode` реализуется и покрывается тестами, но команды для него в этом change нет.
- Доработки `db-service`. Выполняются в соседнем репозитории, здесь фиксируется только контракт.
