## 1. Генератор

- [x] 1.1 Тип манифеста `breakpointView`; `createComponentConfig` вставляет вызов функции ядра в стиль и её импорт
- [x] 1.2 Свойство `integer` (`IntegerProp`) в генераторе
- [x] 1.3 Манифест `templates/Grid/component.json`: `breakpointView: { function: "getBaseGridView", paramSuffix: "MinWidth" }`
- [x] 1.4 Тесты: конфиг Grid с `getBaseGridView` и числом колонок; конфиг без признака не меняется

## 2. Клиент

- [x] 2.1 Тип `integer` в модели свойств и фабрике, числовое поле в панели
- [x] 2.2 Сборка превью: `integer` — числовой литерал
- [x] 2.3 `humanizeName`: разбиение слов с сохранением заглавных сокращений
- [x] 2.4 Тесты клиента: `integer` в превью, подписи

## 3. Web-плагин

- [x] 3.1 Стори Grid строит вид `getBaseGridView` из ширин точек перелома сцены

## 4. Проверки

- [x] 4.1 `npm run typecheck` и `npm test` в `js/cli`; `npm test`, `npx tsc -b` в `js/apps/client`; `npm test`, `npm run build` в плагине
- [x] 4.2 Генерация пакета базовой ДС: в `Grid.config.ts` есть `getBaseGridView` и число колонок, сборка styled-components проходит
- [x] 4.3 Превью Grid в локальном редакторе: колонки по ширине сетки, число колонок в панели
- [x] 4.4 `openspec validate grid-breakpoints-and-integer-props --strict`
