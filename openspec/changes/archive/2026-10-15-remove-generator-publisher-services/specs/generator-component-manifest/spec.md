## MODIFIED Requirements

### Requirement: Component manifest holds what data cannot express

Генератор SHALL читать манифест `js/cli/src/generator/templates/<X>/component.json` и брать из него имена экспортов ядра,
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
- **THEN** шаблоны MUST NOT проверяться и компилироваться вместе с кодом `js/cli`: `tsconfig.json` `js/cli` MUST исключать `src/generator/templates` и `src/generator/constants`

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
- **THEN** CLI MUST вывести stderr сборки и завершить команду с ненулевым кодом
