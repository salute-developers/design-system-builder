## MODIFIED Requirements

### Requirement: Import reads plasma sources and writes the component seed

Инструмент импорта SHALL читать объект токенов компонента из `plasma-new-hope` и конфиг оформления из
`sdds-serv` и записывать папку сида компонента в формате `component-seed-format` и манифест генератора.

#### Scenario: Сухой прогон по умолчанию

- **WHEN** инструмент запущен без `--apply`
- **THEN** он MUST напечатать отчёт и MUST NOT записать ни одного файла

#### Scenario: Применение пишет папку целиком

- **WHEN** инструмент запущен с `--apply`
- **THEN** папка `seeds/prod/components/<имя>/` MUST быть записана целиком
- **THEN** манифест `js/cli/src/generator/templates/<X>/component.json` MUST быть записан, если у компонента есть сведения, не выводимые из данных
- **THEN** инструмент MUST NOT обращаться к каталогу `js/services/generator`

#### Scenario: Удаление трогает только папку компонента

- **WHEN** инструмент запущен с `--remove --apply`
- **THEN** папка названного компонента MUST быть удалена
- **THEN** папки дочерних компонентов и список зависимостей MUST остаться без изменений

#### Scenario: Компонент без объекта токенов

- **WHEN** у компонента ядра нет объекта токенов
- **THEN** инструмент MUST отказать с сообщением, что компонент в модель не ложится
- **THEN** сид MUST NOT быть записан
