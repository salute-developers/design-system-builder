## 1. Контракт и фикстуры

- [ ] 1.1 Создать `backend-kt/preview/contract/schemas/v1/preview-payload.schema.json` в соответствии с расширенным протоколом
- [ ] 1.2 Добавить общие фикстуры `valid` и `invalid` для состояний, alpha, styleRef, assetRef, gradient, shadow spread, ресурсов SVG и PNG
- [ ] 1.3 Описать расширенный контракт в README каталога `backend-kt/preview/contract`

## 2. Клиент: схема и типы

- [ ] 2.1 Обновить скрипты `sync-preview-payload-schema` и добавить проверку побайтового совпадения схемы и фикстур
- [ ] 2.2 Обновить копию схемы и фикстур в `js/apps/client/src/composePreview`
- [ ] 2.3 Обновить типы `types.ts`: `states` массивом `{when, source}`, `alpha`, `styleRef`, `assetRef`, `styles`, gradient, `spread`, `warnings`
- [ ] 2.4 Тест, проверяющий, что все `valid` фикстуры проходят, а `invalid` не проходят схему

## 3. Клиент: assembler

- [ ] 3.1 Обновить `draft.ts` для наборов состояний и расширенных источников из draft
- [ ] 3.2 Обновить `assembler.ts`: массив `states`, сбор `styles`, diagnostic при цикле и неизвестном стиле
- [ ] 3.3 Тесты assembler: минимальный draft без расширенных полей, составное состояние, вложенный стиль, цикл стилей

## 4. Проверки

- [ ] 4.1 Прогнать `npm run build` и тесты клиента
- [ ] 4.2 FAST-проверка `tools/verify fast`
- [ ] 4.3 Независимое ревью
- [ ] 4.4 FULL-проверка `tools/verify full`
- [ ] 4.5 [внешняя проверка] Собрать плагин из парного change в `plasma-android`, подключить к клиенту и убедиться в браузере, что Button рисуется по расширенному payload
