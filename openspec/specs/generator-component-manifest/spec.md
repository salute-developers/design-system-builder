# generator-component-manifest Specification

## Purpose
Определяет манифест и шаблоны компонента в генераторе пакета: где хранится то, что не выводится из данных дизайн-системы, какие формы обёрток генератор умеет писать и как раскладываются составные и multi-appearance компоненты.

## Requirements

### Requirement: Component manifest holds what data cannot express

Генератор SHALL читать манифест `app/templates/<X>/component.json` и брать из него имена экспортов ядра,
реэкспорты `index.ts`, приведение типа, параметры дженерика, соседей без конфига и проп выбора appearance.
Отсутствие манифеста SHALL означать имена по умолчанию `<x>Tokens` и `<x>Config` и обычную обёртку.

#### Scenario: Имя экспорта ядра из манифеста

- **WHEN** манифест задаёт `coreConfigExport` или `coreTokensExport`
- **THEN** сгенерированные файлы MUST импортировать ядро под этим именем
- **THEN** генератор MUST NOT содержать таблицу имён экспортов по компонентам в коде

#### Scenario: Компонент без манифеста

- **WHEN** папки `templates/<X>/` нет
- **THEN** генератор MUST использовать `<x>Config`, `<x>Tokens` и обычную обёртку

#### Scenario: Реэкспорты index.ts

- **WHEN** манифест перечисляет `reexports.runtime`, `types`, `localTypes`, `coreTypes`, `local`
- **THEN** `index.ts` компонента MUST реэкспортировать перечисленное из соответствующих источников
- **THEN** `localTypes` MUST быть объявлены в самой обёртке

#### Scenario: Шаблоны копируются в пакет

- **WHEN** в `templates/<X>/` лежат файлы `.ts` или `.tsx`
- **THEN** они MUST быть скопированы в папку компонента пакета
- **THEN** файлы, кроме обёртки `<X>.tsx`, MUST быть реэкспортированы из `index.ts` через `export *`
- **THEN** шаблоны MUST попадать в сборку генератора и MUST NOT компилироваться вместе с его кодом

### Requirement: Wrapper strategy is chosen by data and manifest

Генератор SHALL выбирать форму обёртки компонента в порядке: несколько appearance, пустой компонент,
шаблонная обёртка, дженерик, обычная.

#### Scenario: Несколько appearance

- **WHEN** манифест задаёт `appearances` и у компонента больше одного конфига
- **THEN** на каждый appearance MUST быть записан конфиг темы в подпапке `<appearance>/<Appearance><X>.config.ts`
- **THEN** обёртка `<X>.tsx` MUST выбирать пару «базовый конфиг ядра `<appearance><X>Config`, конфиг темы» по пропу `appearances.prop`
- **THEN** обёртка MUST пробрасывать ref

#### Scenario: Пустой компонент

- **WHEN** у компонента нет ни свойств в API, ни значений в конфигах
- **THEN** генератор MUST записать обёртку над базовым конфигом ядра без локального конфига темы
- **THEN** пустой конфиг темы MUST NOT быть записан, потому что он подменил бы вариации ядра

#### Scenario: Шаблонная обёртка

- **WHEN** в `templates/<X>/` есть `<X>.tsx` или `<X>.ts`
- **THEN** сгенерированная обёртка MUST NOT быть записана, а конфиги темы MUST быть записаны

#### Scenario: Дженерик-обёртка

- **WHEN** манифест задаёт `generic` с `propsType`, `itemType`, `refElement`
- **THEN** обёртка MUST быть файлом `.tsx`, сохраняющим параметр типа элемента списка через `fixedForwardRef`

#### Scenario: Приведение типа

- **WHEN** манифест задаёт `castToProps`
- **THEN** результат `component(...)` MUST быть приведён к `ForwardRefExoticComponent<Props & RefAttributes<HTMLDivElement>>`
- **THEN** тип MUST импортироваться из `@salutejs/plasma-new-hope/styled-components`

#### Scenario: Соседи без конфига темы

- **WHEN** манифест перечисляет `siblings`
- **THEN** для каждого MUST быть записана пустая обёртка над указанным конфигом ядра рядом с компонентом

### Requirement: Composite components live in the parent folder

Генератор SHALL класть дочерние компоненты связи `compose` в папку родителя и экспортировать с корня
пакета только родителя.

#### Scenario: Дочерний компонент не экспортируется с корня

- **WHEN** компонент является дочерним хотя бы одной связи `compose`
- **THEN** корневой `index.ts` MUST NOT экспортировать его отдельно
- **THEN** его файлы MUST лежать в папке родителя в порядке `order` связи

#### Scenario: Index родителя объединяет детей

- **WHEN** у родителя есть дочерние `compose`
- **THEN** `index.ts` родителя MUST экспортировать родителя, каждого дочернего и дополнительные файлы шаблонов

### Requirement: Config values reference core token keys

Сгенерированный конфиг темы SHALL ссылаться на CSS-переменные через объект токенов ядра по ключу,
равному имени web-параметра свойства.

#### Scenario: Подстановка по ключу

- **WHEN** свойство с web-параметром `buttonHeight` имеет значение
- **THEN** конфиг MUST содержать `[${<x>Tokens.buttonHeight}]: <значение>`
- **THEN** генератор MUST NOT составлять имя CSS-переменной сам

#### Scenario: Состояния по ключу

- **WHEN** значение задано для состояния `hovered` или `pressed`
- **THEN** ключ MUST получить суффикс `Hover` или `Active` соответственно

#### Scenario: Ошибка сборки пакета видна в логе

- **WHEN** сборка сгенерированного пакета завершается ошибкой
- **THEN** генератор MUST вывести stderr сборки в лог и завершить запрос ошибкой
