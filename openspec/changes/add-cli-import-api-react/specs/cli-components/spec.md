## MODIFIED Requirements

### Requirement: API meta import platform

Команда SHALL требовать платформу опцией `--platform` и поддерживать платформы `compose`, `android-view` и `react`.

#### Scenario: Платформа обязательна

- **WHEN** `--platform` не указан
- **THEN** CLI MUST завершиться ошибкой использования до чтения файла и обращения к backend

#### Scenario: Платформа android-view

- **WHEN** платформа — `android-view`
- **THEN** CLI MUST нормализовать мету View и отправить её одним запросом
- **THEN** CLI MUST передать backend `platform` со значением `xml`

#### Scenario: Платформа react

- **WHEN** платформа — `react`
- **THEN** CLI MUST нормализовать веб-мету и отправить её одним запросом
- **THEN** CLI MUST передать backend `platform` со значением `web`

#### Scenario: Неподдержанная платформа

- **WHEN** платформа — `swiftui`
- **THEN** CLI MUST завершиться ненулевым кодом с сообщением, что платформа пока не поддержана
- **THEN** CLI MUST NOT читать файл и MUST NOT обращаться к backend

#### Scenario: Соответствие платформы значению backend

- **WHEN** CLI формирует запрос
- **THEN** он MUST передать `compose` для `compose`, `xml` для `android-view`, `ios` для `swiftui`, `web` для `react`

### Requirement: API meta normalization reads deprecation

Нормализаторы Compose, Android View и web SHALL читать поле `deprecated` свойств меты и передавать его в манифест на уровне платформенного имени. Нормализатор Compose MUST помечать устаревшим имя свойства, если устаревшим помечена хотя бы одна запись с этим `id`, и брать сообщение первой помеченной записи. Нормализатор View MUST помечать устаревшим только имя, соответствующее помеченному `attrName`, и MUST NOT распространять статус на другие `attrName` с тем же `id`. Нормализатор web MUST помечать устаревшим только имя, соответствующее помеченному `paramName`, и MUST NOT распространять статус на другие токены свойства. Пустое сообщение MUST сохраняться как пустая строка и MUST NOT приравниваться к отсутствию пометки. Мета без поля `deprecated` MUST разбираться без ошибки.

#### Scenario: Compose, одна перегрузка помечена

- **WHEN** две записи с одним `id`, и `deprecated` есть только у одной
- **THEN** имя свойства в манифесте MUST содержать `deprecated` с сообщением помеченной записи

#### Scenario: View, помечен один атрибут

- **WHEN** у свойства два `attrName`, и `deprecated` есть только у `sd_textColor`
- **THEN** `sd_textColor` MUST быть передан с `deprecated`, а `android:textColor` MUST быть передан без него

#### Scenario: Web, помечен один токен

- **WHEN** у свойства два токена, и `deprecated` есть только у одного
- **THEN** этот `paramName` MUST быть передан с `deprecated`, а второй MUST быть передан без него

#### Scenario: Web, пометка без сообщения

- **WHEN** у токена `deprecated` равен `{}`
- **THEN** имя в манифесте MUST содержать `deprecated` с пустым `message`

#### Scenario: Пустое сообщение

- **WHEN** `deprecated` имеет `message` равный пустой строке
- **THEN** имя в манифесте MUST содержать `deprecated` с пустым `message`

#### Scenario: Мета без deprecated

- **WHEN** ни одна запись меты не содержит `deprecated`
- **THEN** все имена MUST быть переданы без `deprecated`
- **THEN** разбор MUST завершиться без ошибки

#### Scenario: Слияние записей View одного компонента

- **WHEN** один `attrName` встречается в нескольких записях компонента и помечен хотя бы в одной
- **THEN** имя MUST быть передано с `deprecated` первой помеченной записи

## ADDED Requirements

### Requirement: API meta normalization of web

CLI SHALL преобразовывать веб-мету (`web-api-meta.json` из `generate:api-meta`) в тот же манифест, что и меты Compose и View, по фиксированным правилам до отправки. Запись веб-меты — токен, а не свойство.

#### Scenario: Токены сводятся в свойство

- **WHEN** у компонента несколько токенов с одним `id`
- **THEN** манифест MUST содержать одно свойство на каждую пару `(componentName, id)`
- **THEN** при противоречии типа MUST побеждать первое вхождение, а противоречие MUST быть передано в результат нормализации

#### Scenario: Платформенные имена из ключей токенов

- **WHEN** у свойства есть токены без `state`
- **THEN** `platformNames` свойства MUST содержать их `paramName` в порядке появления без повторов
- **THEN** части типографики (`part`) MUST быть именами одного свойства

#### Scenario: Токены состояний не становятся именами

- **WHEN** у токена есть `state`
- **THEN** его `paramName` MUST NOT попадать в `platformNames`

#### Scenario: Свойство только из токенов состояний

- **WHEN** у всех токенов свойства есть `state`
- **THEN** манифест MUST NOT содержать это свойство
- **THEN** пропуск MUST учитываться в сводке пропущенного

#### Scenario: Состояния компонента

- **WHEN** у токена есть `state` вне словаря состояний взаимодействия (`pressed`, `hovered`, `focused`, `selected`, `activated`, `readonly`, `disabled`)
- **THEN** это состояние в kebab-case MUST быть состоянием компонента
- **THEN** состояния взаимодействия MUST NOT становиться состояниями компонента

#### Scenario: Описание свойства web

- **WHEN** свойство получено из веб-меты
- **THEN** описание MUST иметь вид `token: <paramName>`, а при нескольких именах — перечислять их через `/`

#### Scenario: Подмена типа

- **WHEN** передан `--map-type from:to`
- **THEN** CLI MUST заменить тип `from` на `to` до сведения токенов

#### Scenario: Компонент без токенов

- **WHEN** компонент веб-меты пришёл с пустым `params`
- **THEN** манифест MUST содержать этот компонент без свойств и состояний

#### Scenario: Пустая веб-мета

- **WHEN** мета не содержит ни одного компонента
- **THEN** нормализатор MUST сообщить, что мета пуста, и манифест MUST NOT быть построен

#### Scenario: Мета другой платформы

- **WHEN** с `--platform react` передана мета Compose (у параметров нет `paramName`) или мета View
- **THEN** CLI MUST завершиться ненулевым кодом с сообщением, что файл не веб-мета, и назвать путь файла
- **THEN** CLI MUST NOT обращаться к backend
