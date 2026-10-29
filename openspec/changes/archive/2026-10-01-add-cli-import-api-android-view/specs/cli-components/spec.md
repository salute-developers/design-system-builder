## MODIFIED Requirements

### Requirement: API meta import platform

Команда SHALL брать платформу из `.sdds/config.json`, позволять переопределить её `--platform` и поддерживать платформы `compose` и `android-view`.

#### Scenario: Платформа из config

- **WHEN** `--platform` не указан
- **THEN** CLI MUST использовать платформу из `.sdds/config.json`

#### Scenario: Платформа android-view

- **WHEN** платформа — `android-view`
- **THEN** CLI MUST выполнить импорт так же, как для `compose`: получить мету через делегата, нормализовать и отправить одним запросом
- **THEN** CLI MUST передать backend `platform` со значением `xml`

#### Scenario: Неподдержанная платформа

- **WHEN** платформа — `swiftui` или `react`
- **THEN** CLI MUST завершиться ненулевым кодом с сообщением, что платформа пока не поддержана
- **THEN** CLI MUST NOT запускать процессы и MUST NOT обращаться к backend

#### Scenario: Соответствие платформы значению backend

- **WHEN** CLI формирует запрос
- **THEN** он MUST передать `compose` для `compose`, `xml` для `android-view`, `ios` для `swiftui`, `web` для `react`

### Requirement: API meta import gets the meta from the project artifact

CLI SHALL получать API-мету через capability `API_META` платформенного делегата, а не из рабочей копии исходников plasma-android, и MUST читать результат после успешного завершения инструмента.

#### Scenario: Мета Compose

- **WHEN** платформа — `compose`
- **THEN** CLI MUST запустить делегата с capability `API_META`
- **THEN** после успешного завершения CLI MUST прочитать `<workspaceDir>/build/theme-builder/components/uikit-compose-api-meta.json`

#### Scenario: Мета View

- **WHEN** платформа — `android-view`
- **THEN** CLI MUST запустить делегата с capability `API_META`
- **THEN** после успешного завершения CLI MUST прочитать `<workspaceDir>/build/theme-builder/components/uikit-api-meta.json`

#### Scenario: Инструмент не запускается до проверок

- **WHEN** нет project context, явного API URL или credentials
- **THEN** CLI MUST отказать с диагностикой и MUST NOT запускать Gradle

#### Scenario: Файл не найден или пуст

- **WHEN** файл отсутствует либо не содержит ни одного компонента (пустой список меты Compose или пустая мета View)
- **THEN** CLI MUST завершиться ненулевым кодом с сообщением, что артефакт uikit не найден в classpath проекта, и назвать ожидаемый путь
- **THEN** CLI MUST NOT отправлять запрос на backend

#### Scenario: Ошибка инструмента

- **WHEN** делегат сообщает о сбое или об отсутствии toolchain
- **THEN** CLI MUST показать сообщение делегата и завершиться ненулевым кодом

## ADDED Requirements

### Requirement: API meta normalization of Android View

CLI SHALL преобразовывать API-мету View в тот же манифест, что и мету Compose, по фиксированным правилам до отправки. Нормализатор MUST читать мету в форме, которую оставляет плагин `dsBuilder`: поля со значениями по умолчанию в ней могут отсутствовать.

#### Scenario: Запись с несколькими именами разворачивается

- **WHEN** запись содержит несколько `componentNames`
- **THEN** манифест MUST содержать каждый из этих компонентов
- **THEN** параметры записи MUST быть у каждого из них

#### Scenario: Записи одного компонента сливаются

- **WHEN** один компонент описан в нескольких записях
- **THEN** манифест MUST содержать одно свойство на каждую пару `(component, id)`
- **THEN** при противоречии типа MUST побеждать первое вхождение, а противоречие MUST быть передано в результат нормализации

#### Scenario: Параметры без темизируемого значения пропускаются

- **WHEN** параметр имеет тип `unknown`
- **THEN** манифест MUST NOT содержать это свойство
- **THEN** пропуск MUST учитываться в сводке пропущенного

#### Scenario: Записи вложенных стилей пропускаются

- **WHEN** запись содержит `subStyle`
- **THEN** манифест MUST NOT содержать её параметры
- **THEN** пропуск MUST учитываться в сводке пропущенного

#### Scenario: Платформенные имена из атрибутов

- **WHEN** у свойства один или несколько `attrName` (после слияния записей)
- **THEN** `platformNames` свойства MUST содержать все `attrName` в порядке появления без повторов

#### Scenario: Описание свойства View

- **WHEN** свойство получено из меты View
- **THEN** описание MUST иметь вид `attr: <attrName>`
- **THEN** при нескольких `attrName` описание MUST перечислять их через `/`
- **THEN** описание MUST NOT содержать полей меты, которых у View нет (`method`, `param`)

#### Scenario: Состояния из наборов состояний

- **WHEN** запись содержит `stateSets`
- **THEN** состояниями компонента MUST быть `configName` состояний наборов, уникальные в пределах компонента
- **THEN** `stateValues` параметров и `sharedStates` MUST NOT становиться состояниями компонента

#### Scenario: Подмена типа

- **WHEN** передан `--map-type from:to`
- **THEN** CLI MUST заменить тип `from` на `to` до отправки

#### Scenario: Пустая мета

- **WHEN** мета не содержит ни одного компонента с параметрами
- **THEN** нормализатор MUST сообщить, что мета пуста, и манифест MUST NOT быть построен

### Requirement: API meta import reports skipped entries

CLI SHALL сообщать, что нормализатор пропустил, и MUST NOT скрывать пропуски.

#### Scenario: Сводка пропущенного

- **WHEN** нормализатор пропустил параметры или записи
- **THEN** CLI MUST напечатать после отчёта одну строку на каждую категорию пропусков с числом пропущенных элементов
- **THEN** пропущенное MUST NOT попадать в `rejected` backend

#### Scenario: Нет пропусков

- **WHEN** нормализатор ничего не пропустил
- **THEN** CLI MUST NOT печатать сводку пропущенного
