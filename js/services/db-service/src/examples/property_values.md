# Отображение (appearance)

## Дизайн система SDDS 

### Button

#### Отображение default

##### View

###### Primary (style) - default
- backgroundColor = dark.text.default.accent
- labelColor = dark.text.default.primary
- valueColor = dark.text.default.secondary
- droppedShadow = up.hard.s
Стейты:
- backgroundColor[pressed] = dark.text.default.secondary
- labelColor[hovered] = dark.text.default.accent

###### Secondary (style)
- backgroundColor = dark.text.default.secondary
- labelColor = dark.text.default.primary 
- valueColor = dark.text.default.primary

##### Size

###### S (style)
- height = 30
- width = 200
- shape = round.xs

###### M (style) - default
- height = 4
- width = 250
- shape = round.xs

##### Shape

###### Rounded - default
- shape = round.circle

##### Инвариант
- focusColor = dark.text.default.accent
- disabledAlpha = 0.4
Стейты:
- focusColor[focused] = dark.text.default.primary
- disabledAlpha[disabled] = 0.2

##### Пересечения (для style_combinations таблицы)

#### primary + s + rounded
- width = 500
- height = 30
- labelColor = dark.text.default.accent 

#### Отображение outline

##### View

###### Primary (style) - default
- borderColor = dark.text.default.accent
- labelColor = dark.text.default.primary 
- valueColor = dark.text.default.secondary
- droppedShadow = up.hard.s

##### Size

###### M (style) - default
- height = 4
- width = 250
- shape = round.s

##### Инвариант
- focusColor = dark.text.default.primary
- disabledAlpha = 0.4

### Text

#### Отображение default

##### Size

###### S (style) - default
- fontStyle = screen-s.header.h2.normal

###### M (style)
- fontStyle = screen-s.display.l.normal

### Link

#### Отображение default

##### View

###### Primary (style) - default
- valueColor = dark.text.default.accent

##### Size

###### S (style) - default
- underLineWidth = 0.5

###### M (style)
- underLineWidth = 1

### TextField

#### Отображение default

##### View

###### Primary (style) - default
- backgroundColor = dark.text.default.secondary
- valueColor = dark.text.default.primary

##### Size

###### S (style) - default
- valueFontStyle = screen-s.header.h2.normal

###### M (style)
- valueFontStyle = screen-s.display.l.normal

##### Инвариант
- focusColor = dark.text.default.accent
- disabledAlpha = 0.4

#### Отображение outline

##### View

###### Primary (style) - default
- borderColor = dark.text.default.accent
- valueColor = dark.text.default.primary

##### Size

###### M (style) - default
- valueFontStyle = screen-s.display.l.normal

##### Инвариант
- focusColor = dark.text.default.primary
- disabledAlpha = 0.4

## Дизайн система PLASMA

### Button

#### Отображение default

##### View

###### Primary (style)
- backgroundColor = dark.text.default.accent
- labelColor = dark.text.default.primary
- valueColor = dark.text.default.secondary
- droppedShadow = up.hard.m

###### Secondary (style) - default
- backgroundColor = dark.text.default.secondary
- labelColor = dark.text.default.primary
- valueColor = dark.text.default.primary

##### Size

###### S (style)
- height = 32
- width = 200
- shape = round.xxs

###### M (style) - default
- height = 44
- width = 280
- shape = round.xs

##### Инвариант
- focusColor = dark.text.default.accent
- disabledAlpha = 0.4

### Text

#### Отображение default

##### Size

###### S (style) - default
- fontStyle = screen-s.header.h2.normal

###### M (style)
- fontStyle = screen-s.display.l.normal

### Link

#### Отображение default

##### View

###### Primary (style) - default
- valueColor = dark.text.default.accent

##### Size

###### S (style) - default
- underLineWidth = 1

###### M (style)
- underLineWidth = 2

##### Пересечения (для style_combinations таблицы)

#### primary + m
- valueColor = dark.text.default.primary
- underLineWidth = 5

# ВАЖНО

Если отображение для компонента не описано, значит его нет в данной дизайн системе.
Все компоненты, чьи стили описаны для дизайн системы, автоматически считаются записями в таблице design_system_components.

Если у значения свойства указан текст (например dark.text.default.accent), то это токен темы — ссылаться на него по token_id.
Если у значения указано число (например 0.4, 30, 200), то это прямое значение — сохраняется в поле value.

Стейты задаются в формате: propertyName[state] = value
Строки без [state] — это основное значение (state IS NULL в БД).
Строки с [state] — дополнительные записи в той же таблице с заполненным полем state.

Пересечения (style_combinations) принадлежат тому отображению (appearance),
под чьей секцией они описаны. appearance_id берётся оттуда.

property_variations выводятся из структуры компонента:
каждый пропс, перечисленный внутри вариации в components.md, = запись в таблице property_variations.

Вот пример реализации пересечения стилей

style_combinations:
id      | property_id | value
--------|-------------|------
comb-1  | padding     | 6px    -- primary + s + round
comb-2  | padding     | 10px   -- primary + m + round
comb-3  | padding     | 14px   -- primary + l + round

style_combination_members:
combination_id | style_id
---------------|----------
comb-1         | primary
comb-1         | s
comb-1         | round
comb-2         | primary
comb-2         | m
comb-2         | round
comb-3         | primary
comb-3         | l
comb-3         | round