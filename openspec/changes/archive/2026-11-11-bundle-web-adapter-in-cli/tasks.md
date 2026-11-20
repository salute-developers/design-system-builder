## 1. Данные web-адаптера

- [x] 1.1 Скопировать `js/apps/preview-web-plugin/src/data/web-adapter.json` в `js/cli/src/data/web-adapter.json` без изменений
- [x] 1.2 Добавить в обе копии записи 23 новых web-компонентов (`componentName`, `name`, `description`) в порядке `componentName`
- [x] 1.3 Перенести шаблоны из `webTemplates` манифестов `import:plasma` 11 компонентов (Attach, Autocomplete, Calendar, CalendarDouble, DatePicker, DateTimePicker, InformationWrapper, Table, TextFieldSlider, TimePicker, Tree) в `styles.default.templates` обеих копий

## 2. Генератор

- [x] 2.1 `components-input.ts`: без `--web` читать встроенный `src/data/web-adapter.json` от каталога CLI, с `--web <каталог>` — `<каталог>/web-adapter.json`
- [x] 2.2 `component-source.ts`: принимать путь к файлу адаптера вместо каталога, обновить комментарии об источнике данных
- [x] 2.3 `component-source.ts`: стиль без поля `props` считать стилем без значений (`valuesOf`, `toConfig`)
- [x] 2.4 Обновить справку `--web` в `components.ts` и `ds.ts`

## 3. Импорт plasma

- [x] 3.1 `import-plasma-component.ts`: не писать `webTemplates` в манифест, печатать шаблоны в отчёте фрагментом записи `web-adapter.json`
- [x] 3.2 Удалить `webTemplates` из 11 манифестов `js/cli/src/generator/templates/<X>/component.json`, в том числе через `npm run import:plasma -- --component=<X> --manifest --apply`, если он даёт тот же результат
- [x] 3.3 Обновить тест `import-plasma-component.test.ts`: шаблона нет ни в манифесте, ни в пакете, он есть в отчёте

## 4. Тесты генератора

- [x] 4.1 Тест совпадения двух копий `web-adapter.json`
- [x] 4.2 Тест: без `--web` генератор берёт шаблоны, имя и `compose` из встроенного файла и не читает `<sdds>/web/web-adapter.json`
- [x] 4.3 Тест: `--web` подменяет источник адаптера
- [x] 4.4 Тест: конфигурация со стилем без `props` читается без ошибки, стиль передаётся генератору

## 5. Документация

- [x] 5.1 `js/cli/README.md`: где лежит `web-adapter.json` и что копии должны совпадать
- [x] 5.2 Скилл `add-component`: шаблоны нового компонента из отчёта импорта дописываются в обе копии `web-adapter.json`, не в базу и не в манифест; убрать упоминания `webTemplates`

## 6. Проверки

- [x] 6.1 `npm test` и `npm run typecheck` в `js/cli`
- [x] 6.2 `npm test` и `npm run build` в `js/apps/preview-web-plugin`
- [x] 6.3 Сгенерировать пакет базовой ДС из выгрузки локального стенда без `--web` и проверить, что многозначные свойства новых компонентов (например, `textFieldPadding` у Autocomplete) получают шаблон в `*.config.ts`
- [x] 6.4 `openspec validate bundle-web-adapter-in-cli --strict`
