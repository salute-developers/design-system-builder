## 1. Контракт и фикстуры

- [x] 1.1 Создать `backend-kt/preview/contract/schemas/v1/preview-payload.schema.json` в соответствии с расширенным протоколом
- [x] 1.2 Добавить общие фикстуры `valid` и `invalid` для состояний, alpha, styleRef, assetRef, gradient, shadow spread, ресурсов SVG и PNG
- [x] 1.3 Описать расширенный контракт в README каталога `backend-kt/preview/contract`

## 2. Клиент: схема и типы

- [x] 2.1 Обновить скрипты `sync-preview-payload-schema` и добавить проверку побайтового совпадения схемы и фикстур
- [x] 2.2 Обновить копию схемы и фикстур в `js/apps/client/src/composePreview`
- [x] 2.3 Обновить типы `types.ts`: `states` массивом `{when, source}`, `alpha`, `styleRef`, `assetRef`, `styles`, gradient, `spread`, `warnings`
- [x] 2.4 Тест, проверяющий, что все `valid` фикстуры проходят, а `invalid` не проходят схему

## 3. Клиент: assembler

- [x] 3.1 Обновить `draft.ts` для наборов состояний и расширенных источников из draft
- [x] 3.2 Обновить `assembler.ts`: массив `states`, сбор `styles`, diagnostic при цикле и неизвестном стиле
- [x] 3.3 Тесты assembler: минимальный draft без расширенных полей, составное состояние, вложенный стиль, цикл стилей

## 4. Проверки

- [x] 4.1 Прогнать `npm run build` и тесты клиента
- [x] 4.2 FAST-проверка `tools/verify fast`
- [x] 4.3 Независимое ревью
- [x] 4.4 FULL-проверка `tools/verify full` (падение `javascript-cli` известно, воспроизводится на `dev`)
- [x] 4.5 [внешняя проверка] Собрать плагин из парного change в `plasma-android`, подключить к клиенту и убедиться в браузере, что Button рисуется по расширенному payload
