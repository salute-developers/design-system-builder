## REMOVED Requirements

### Requirement: Import reads plasma sources and writes the component seed

**Reason**: сиды db-service удаляются; инструмент пишет пакет `.sdds/components`.
**Migration**: требование «Import reads plasma sources and writes the component package».

### Requirement: Composite components are imported from a directory

**Reason**: результат составного импорта меняется: конфиги по appearance в пакете, связи в отчёте.
**Migration**: требование «Composite components are imported from a directory into the package».

## ADDED Requirements

### Requirement: Import reads plasma sources and writes the component package

Инструмент `import:plasma` в `js/cli` SHALL читать объект токенов компонента из `plasma-new-hope`, конфиг оформления из `sdds-serv` и имена, типы и web-значения формы токенов темы из `.sdds/tenants/<тема>`, и записывать конфигурации компонента в пакет `.sdds/components` в native-формате пакета (`<component>_<style>_config.json`, запись в `meta.json`) и манифест генератора `templates/<X>/component.json`. Шаблоны web-параметров инструмент SHALL записывать в поле `webTemplates` манифеста и MUST NOT записывать в конфигурации пакета.

#### Scenario: Сухой прогон по умолчанию

- **WHEN** инструмент запущен без `--apply`
- **THEN** он MUST напечатать отчёт и состав пакета и MUST NOT записать ни одного файла

#### Scenario: Применение пишет записи компонента

- **WHEN** инструмент запущен с `--apply`
- **THEN** в `meta.json` MUST появиться запись на каждый appearance компонента, а файлы конфигов MUST быть записаны в native-формате пакета
- **THEN** записи других компонентов пакета MUST остаться нетронутыми
- **THEN** повторный запуск с `--apply` MUST заменить записи этого компонента без `--remove`

#### Scenario: Удаление трогает только записи компонента

- **WHEN** инструмент запущен с `--remove --apply`
- **THEN** он MUST удалить файлы конфигов компонента и его записи в `meta.json`
- **THEN** манифест генератора и записи других компонентов MUST остаться

#### Scenario: Локальная тема обязательна

- **WHEN** в `.sdds/tenants` нет темы, из которой берутся имена токенов
- **THEN** инструмент MUST остановиться до разбора и назвать команду `dsbuilder theme fetch`

#### Scenario: Тип свойства сверяется с глобальным слоем

- **WHEN** в `.sdds/web/web-api-meta.json` лежит аннотированный тип web-параметра и он не совпадает с типом, который вывел инструмент
- **THEN** инструмент MUST вынести расхождение в раздел «ТРЕБУЕТ РЕШЕНИЯ» отчёта, а для радиуса принять токен формы через `--shape=<свойство>=<round.*>` и оставить свойство типом `shape`

#### Scenario: Компонент без объекта токенов

- **WHEN** у компонента есть обёртка в `sdds-serv`, но нет конфига темы или конфиг без стилей
- **THEN** инструмент MUST записать запись пакета с пустой конфигурацией и манифест, чтобы пакет экспортировал компонент

### Requirement: Composite components are imported from a directory into the package

Инструмент SHALL импортировать составной компонент из папки с подпапками-appearance: каждый элемент становится компонентом пакета, каждый appearance — отдельной записью `meta.json` с именем стиля, равным имени appearance; проп выбора appearance уходит в манифест; связи `compose` родителя с дочерними элементами инструмент SHALL печатать в отчёте и MUST NOT записывать сам.

#### Scenario: Подпапки становятся appearance

- **WHEN** в папке `--dir` есть подпапки `horizontal` и `vertical` с конфигами элементов
- **THEN** для каждого элемента MUST появиться записи `meta.json` со `styleName` `horizontal` и `vertical`

#### Scenario: Связи печатаются, а не пишутся

- **WHEN** у составного компонента есть дочерние элементы
- **THEN** отчёт MUST перечислить пары «родитель → дочерний» типа `compose` с порядком
- **THEN** инструмент MUST NOT обращаться к API и MUST NOT править файлы связей
