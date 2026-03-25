# Компоненты 

## Button

Компонент кнопка.

### Вариации

#### View (Вид в description)
Пропсы:
- backgroundColor: color
- labelColor: color
- valueColor: color
- droppedShadow: color
- borderColor: color

#### Size (Размер в description)
Пропсы:
- height: dimension
- width: dimension
- shape: shape

#### Shape (Форма в description)
Пропсы:
- shape: shape

### Инварианты
Пропсы:
- focusColor: color
- disabledAlpha: float

## Text

Компонент текст.

### Вариации

#### Size
Пропсы:
- fontStyle: typography

## Link (зависит от компонента Text)

Компонент ссылка.

### Вариации

#### View (Вид в description)
Пропсы:
- valueColor: color

#### Size (Размер в description)
Пропсы:
- underLineWidth: float
Пропсы из компонента Text (через таблицы)

## TextField

Компонент поле для ввода.

### Вариации

#### View (Вид в description)
Пропсы:
- backgroundColor: color
- borderColor: color
- valueColor: color

#### Size (Размер в description)
Пропсы:
- valueFontStyle: typography

# ВАЖНО

Каждый пропс имен элиас для платформы, и формируется по принципу <название_платформы>_<название пропса>, например: xml_backgroundColor, web_valueLineHeight и т.д. Нужно сделать для всех 4ых платформ

пример таблицы с зависимым друг от друга компонентами (дословно реализовывать не надо)

parent_id  | child_id
-----------|----------
textField     | text
popover       | text      -- если popover тоже использует text
combobox      | textField
combobox      | popover

combobox (id: 1) — собственный пропс: disabled
  └── textField (id: 2) — пропсы: size, variant
        └── text (id: 3) — пропсы: fontSize, color

parent_id | child_id
----------|----------
1         | 2          -- combobox -> textField
2         | 3          -- textField -> text

Результат

prop_name | component_name
----------|---------------
disabled         | combobox
heightSize       | textField
variant          | textField
fontSize         | text
color            | text
