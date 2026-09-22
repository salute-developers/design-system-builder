# Spec Delta

## ADDED Requirements

### Requirement: Flag variation is a single style named true

`db-service` SHALL хранить вариацию-флаг (`pilled`, `stretch`) как вариацию с единственным стилем `true`
без дефолта, как в конфиге ядра. Стиль `false` SHALL NOT существовать: выключенное состояние — отсутствие
дефолта и отсутствие ключа в `defaults` конфига.

#### Scenario: Флаг без дефолта

- **WHEN** сид или импорт заводит вариацию с единственным стилем `true`
- **THEN** объявление вариации на appearance MUST остаться без дефолта
- **THEN** экспорт конфига MUST NOT содержать ключ этой вариации в `defaults`

#### Scenario: Стиль false не заводится

- **WHEN** конфиг оформления описывает только включённое состояние флага
- **THEN** сид MUST NOT создавать стиль `false`
- **THEN** проп компонента в пакете MUST типизироваться как `boolean`

#### Scenario: Дефолт снимается

- **WHEN** у объявления вариации снимают дефолт
- **THEN** объявление MUST остаться на месте с пустым дефолтом

### Requirement: Web parameter name equals the core token key

Имя web-параметра свойства SHALL совпадать с ключом объекта токенов ядра компонента (`buttonHeight`,
`itemColorHover`). Имя CSS-переменной SHALL NOT храниться в модели: его выводят потребители по ключу.

#### Scenario: Параметр хранится ключом

- **WHEN** свойство получает web-параметр
- **THEN** его имя MUST быть ключом объекта токенов ядра
- **THEN** оно MUST NOT начинаться с `--plasma`

#### Scenario: Ключ состояния выводится

- **WHEN** значение свойства задано для состояния
- **THEN** ключ состояния MUST выводиться из базового ключа суффиксом (`Hover`, `Active`)
- **THEN** отдельный web-параметр для состояния MUST NOT храниться

### Requirement: Value property carries a raw CSS string

Свойство типа `value` SHALL нести строку CSS без ссылки на токен и без преобразований, и SHALL
отдаваться всем потребителям как есть.

#### Scenario: Значение без токена

- **WHEN** свойство `value` получает `100%` или `var(--plasma-x)`
- **THEN** строка MUST быть сохранена без изменений
- **THEN** ссылка на токен темы MUST отсутствовать

#### Scenario: Все ручки отдают строку как есть

- **WHEN** любой читающий endpoint возвращает значение свойства `value`
- **THEN** он MUST вернуть сохранённую строку без нормализации

### Requirement: Legacy component configs follow appearance declarations

Endpoint `GET /:name/component-configs` SHALL строить состав и порядок вариаций каждого appearance по
объявлениям этого appearance, а не по всем вариациям компонента.

#### Scenario: Appearance без части вариаций

- **WHEN** appearance объявляет подмножество вариаций компонента
- **THEN** ответ MUST содержать для него только объявленные вариации в порядке `position`
- **THEN** дефолты MUST браться из объявлений этого appearance

#### Scenario: Appearance без объявлений

- **WHEN** у appearance нет ни одного объявления вариации
- **THEN** ответ MUST содержать все вариации компонента в порядке их объявления

### Requirement: Style combinations are seedable

Значения на сочетании стилей разных вариаций SHALL записываться сидом в `style_combinations` по
именам стилей и вариаций.

#### Scenario: Сочетание по именам

- **WHEN** сид appearance содержит `combinations` с `styles: { view: 'clear', itemView: 'accent' }`
- **THEN** сидер MUST разрешить имена в стили и записать значение на сочетание
- **THEN** повторный сид MUST NOT дублировать сочетание
