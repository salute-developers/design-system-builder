## MODIFIED Requirements

### Requirement: API meta import platform

Команда SHALL требовать платформу опцией `--platform` и поддерживать платформы `compose`, `android-view` и `swiftui`.

#### Scenario: Платформа обязательна

- **WHEN** `--platform` не указан
- **THEN** CLI MUST завершиться ошибкой использования до чтения файла и обращения к backend

#### Scenario: Платформа android-view

- **WHEN** платформа — `android-view`
- **THEN** CLI MUST нормализовать мету View и отправить её одним запросом
- **THEN** CLI MUST передать backend `platform` со значением `xml`

#### Scenario: Платформа swiftui

- **WHEN** платформа — `swiftui`
- **THEN** CLI MUST нормализовать мету SwiftUI и отправить её одним запросом
- **THEN** CLI MUST передать backend `platform` со значением `ios`

#### Scenario: Неподдержанная платформа

- **WHEN** платформа — `react`
- **THEN** CLI MUST завершиться ненулевым кодом с сообщением, что платформа пока не поддержана
- **THEN** CLI MUST NOT читать файл и MUST NOT обращаться к backend

#### Scenario: Соответствие платформы значению backend

- **WHEN** CLI формирует запрос
- **THEN** он MUST передать `compose` для `compose`, `xml` для `android-view`, `ios` для `swiftui`, `web` для `react`

## ADDED Requirements

### Requirement: API meta normalization of SwiftUI

CLI SHALL преобразовывать API-мету SwiftUI в тот же манифест, что и мету Compose, по фиксированным правилам до отправки. Нормализатор MUST читать мету в форме, которую оставляет генератор iOS: необязательные поля в ней могут отсутствовать.

#### Scenario: Ключ свойства

- **WHEN** один `id` повторяется у компонента
- **THEN** манифест MUST содержать одно свойство `(component, id)`
- **THEN** при противоречии типа MUST побеждать первое вхождение, а противоречие MUST быть передано в результат нормализации

#### Scenario: Платформенное имя

- **WHEN** у параметра задан `methodName`
- **THEN** `platformNames` свойства MUST содержать `methodName`

#### Scenario: Описание свойства

- **WHEN** у параметра заданы `group`, `methodName` и `paramSimpleType`
- **THEN** описание MUST иметь вид `group: <group>; method: <methodName>; param: <paramSimpleType>`

#### Scenario: Параметры без кода на платформе пропускаются

- **WHEN** у параметра пуст `methodName` или задан `unmapped`
- **THEN** манифест MUST NOT содержать это свойство
- **THEN** пропуск MUST учитываться в сводке пропущенного категорией `unmapped`

#### Scenario: Состояния компонента

- **WHEN** запись содержит `stateEnum.values`
- **THEN** состояниями компонента MUST быть `configName` значений, если он задан, иначе `name` в kebab-case нижнего регистра
- **THEN** поле `state` отдельных параметров MUST NOT становиться состоянием компонента

#### Scenario: Компонент без объявленных состояний

- **WHEN** запись не содержит `stateEnum`
- **THEN** список состояний компонента MUST быть пуст

#### Scenario: Служебные признаки генератора не передаются

- **WHEN** у параметра заданы `copyOf`, `fromVariation`, `valueEnum`, `markupValue`, `markupZero`, `rawNumber`, `alwaysEmit`, `stateOnly` или `sizeFromIconId`
- **THEN** манифест MUST NOT содержать этих полей
- **THEN** наличие этих полей MUST NOT менять тип и имя свойства

#### Scenario: Подмена типа

- **WHEN** передан `--map-type from:to`
- **THEN** CLI MUST заменить тип `from` на `to` до отправки

#### Scenario: Пустая мета

- **WHEN** мета не содержит ни одного компонента со свойствами
- **THEN** нормализатор MUST сообщить, что мета пуста, и манифест MUST NOT быть построен

#### Scenario: Мета другой платформы

- **WHEN** корень файла не является массивом записей компонентов
- **THEN** нормализатор MUST вернуть ошибку разбора и MUST NOT выбрасывать исключение
