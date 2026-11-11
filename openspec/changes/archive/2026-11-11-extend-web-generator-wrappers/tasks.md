## 1. Реэкспорт ядра

- [x] 1.1 `package-output.ts`: список `CORE_REEXPORTS` (`SSRProvider`) и его реэкспорт в корневом `src/index.ts`, когда в пакете есть компоненты
- [x] 1.2 Тест: корневой индекс пакета компонентов содержит реэкспорт `SSRProvider`, пакета только с темой — нет

## 2. Дженерик-обёртка с несколькими appearance

- [x] 2.1 `createGenericComponent`: при нескольких appearance — компонент на appearance, `createConditionalComponent`, `appearance` в типе пропсов
- [x] 2.2 `generate.ts`: передавать имена appearance в дженерик-обёртку
- [x] 2.3 Тест: исходник обёртки Select с `default` и `clear` синтаксически корректен и выбирает appearance

## 3. Компонент, которому нужна тема

- [x] 3.1 Тип манифеста: `requiresTheme`; генерация знает, будет ли в пакете тема (`generate:ds`, `generate:components` с `--package` и без)
- [x] 3.2 Пропуск компонента с `requiresTheme` без темы с предупреждением
- [x] 3.3 Шаблон и манифест `templates/ViewContainer/` (`requiresTheme: true`, конфиг из `viewContainer` темы)
- [x] 3.4 Тест: ViewContainer попадает в пакет с темой и пропускается в пакете без темы

## 4. Данные и превью

- [x] 4.1 Завести ViewContainer в локальную базовую ДС пустым компонентом
- [x] 4.2 Запись ViewContainer в обе копии `web-adapter.json`
- [x] 4.3 Story ViewContainer в web-плагине, реестр, манифест плагина и тест манифеста; убрать ViewContainer из `unsupportedWebComponents` клиента
- [x] 4.4 Скилл `add-component` и `js/cli/README.md`: `requiresTheme`, реэкспорты ядра, дженерик с appearance

## 5. Проверки

- [x] 5.1 `npm run typecheck` и `npm test` в `js/cli`; `npm test`, `npm run build` в `js/apps/preview-web-plugin`; тест меню клиента
- [x] 5.2 Сгенерировать `generate:ds` и `generate:components --package` из выгрузки локальной ДС: сборка styled-components и `tsc` без новых ошибок, в пакете с темой есть ViewContainer, `SSRProvider`, `Select` с `clear`, `CodeArea` с `has-wrapper`
- [x] 5.3 Превью ViewContainer и Select в локальном редакторе
- [x] 5.4 `openspec validate extend-web-generator-wrappers --strict`
