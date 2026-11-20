## MODIFIED Requirements

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

#### Scenario: Дженерик-обёртка с несколькими appearance

- **WHEN** манифест задаёт `generic`, а у компонента больше одного конфига
- **THEN** обёртка MUST собрать компонент ядра на каждый appearance из его конфига темы `<X>.config.ts` или `<X>.<appearance>.config.ts`
- **THEN** выбор appearance MUST выполняться через `createConditionalComponent` по пропу `appearance`
- **THEN** тип пропсов MUST содержать необязательный `appearance` с перечислением имён appearance и сохранять параметр типа элемента списка

#### Scenario: Приведение типа

- **WHEN** манифест задаёт `castToProps`
- **THEN** результат `component(...)` MUST быть приведён к `ForwardRefExoticComponent<Props & RefAttributes<HTMLDivElement>>`
- **THEN** тип MUST импортироваться из `@salutejs/plasma-new-hope/styled-components`

#### Scenario: Соседи без конфига темы

- **WHEN** манифест перечисляет `siblings`
- **THEN** для каждого MUST быть записана пустая обёртка над указанным конфигом ядра рядом с компонентом

#### Scenario: Компоненту нужна тема пакета

- **WHEN** манифест задаёт `requiresTheme: true`
- **THEN** компонент MUST генерироваться только в пакет, где есть тема
- **THEN** без темы генератор MUST пропустить компонент, напечатать предупреждение с его именем и MUST NOT завершаться ошибкой
