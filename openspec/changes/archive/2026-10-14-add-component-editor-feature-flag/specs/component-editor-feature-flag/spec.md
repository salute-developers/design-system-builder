## ADDED Requirements

### Requirement: Раздел компонентов включается сборочным флагом

Клиент SHALL показывать раздел «Компоненты» редактора только если при сборке задана переменная `VITE_COMPONENT_EDITOR_ENABLED` со значением `true`. При другом значении раздел MUST быть выключен; без значения раздел включён в dev-сервере и выключен в production-сборке.

#### Scenario: Флаг включён

- **WHEN** клиент собран с `VITE_COMPONENT_EDITOR_ENABLED=true`
- **THEN** кнопка раздела «Компоненты» MUST показываться при наличии компонентов у дизайн-системы
- **AND** адрес `.../components[/<имя>]` MUST открывать редактор компонентов.

#### Scenario: Флаг выключен

- **WHEN** клиент собран с `VITE_COMPONENT_EDITOR_ENABLED=false`
- **THEN** кнопка раздела «Компоненты» MUST NOT показываться.

#### Scenario: Production-сборка без значения

- **WHEN** production-сборка выполнена без `VITE_COMPONENT_EDITOR_ENABLED`
- **THEN** раздел MUST быть выключен.

#### Scenario: Dev-сервер без значения

- **WHEN** клиент запущен в dev-сервере без `VITE_COMPONENT_EDITOR_ENABLED`
- **THEN** раздел MUST быть включён.

### Requirement: Выключенный раздел недоступен по адресу и не грузит данные

При выключенном разделе клиент SHALL перенаправлять адрес `.../components[/<имя>]` на раздел `colors` и MUST NOT запрашивать конфигурации компонентов. Остальные разделы редактора темы MUST работать без изменений.

#### Scenario: Переход по сохранённой ссылке

- **WHEN** флаг выключен и пользователь открывает адрес `.../components/Button`
- **THEN** клиент MUST перенаправить его на `.../colors`.

#### Scenario: Загрузка темы

- **WHEN** флаг выключен и клиент загружает тему для редактора
- **THEN** запросы `component-configs` MUST NOT выполняться
- **AND** палитры, токены, типографика и формы MUST загружаться и редактироваться как раньше.

### Requirement: Окружения собираются с заданным значением флага

Сборка DEV SHALL выполняться с включённым флагом, сборка PROM — с выключенным. Локальная разработка (`vite dev` и `js/docker-compose.dev.yml`) SHALL включать флаг по умолчанию.

#### Scenario: Сборка PROM

- **WHEN** workflow публикации PROM собирает клиент
- **THEN** `VITE_COMPONENT_EDITOR_ENABLED` MUST быть равна `false`.

#### Scenario: Сборка DEV

- **WHEN** workflow публикации DEV собирает клиент
- **THEN** `VITE_COMPONENT_EDITOR_ENABLED` MUST быть равна `true`.
