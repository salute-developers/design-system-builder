## Зачем

Web-генератор тем в `js/cli` строит медиазапросы адаптивной типографики по зашитой константе
`webBreakpoints` (≤559, 560–959, ≥960 px). Командам, у которых сетка другая (например ≤959, 960–1280,
≥1281 px), приходится править сгенерированный CSS руками. Брейкпоинты — свойство проекта, поэтому их
нужно задавать в `.sdds/config.json`, а генератор — брать их оттуда.

## Что меняется

- `.sdds/config.json` получает необязательный массив `breakpoints`:
  `[{ "name": "screenS", "to": 959 }, { "name": "screenM", "from": 960, "to": 1280 }, { "name": "screenL", "from": 1281 }]`.
  `from` — минимальная ширина экрана, `to` — максимальная; генератор сам переводит их в аргументы
  `getMediaQuery` из `plasma-tokens-utils`, где одиночные границы трактуются наоборот.
- `generate:theme` и `generate:ds` в `js/cli` читают `breakpoints` и применяют их к медиазапросам
  типографики во всех файлах темы: `themes/<имя>__dark|light.ts`, `css/<имя>__dark|light.css`,
  `css/<имя>.module.css`. Без ключа результат генерации не меняется.
- В темах генерируются медиазапросы только для описанных в массиве экранов. У сетки обязаны быть
  начало и конец: у первого экрана нет нижней границы, у последнего — верхней, у остальных заданы обе.
  Нарушение приводит к ошибке до записи файлов. Стыковка соседних экранов не проверяется.
- `ProjectConfig` в `frontend-kt/core-workspace` знает поле `breakpoints` (JSON-массив, хранится как
  есть): `dsbuilder` не падает на таком config и сохраняет поле, когда переписывает config
  (`theme fetch`, алиасы тем).

## Возможности

### Новые возможности

Нет.

### Изменяемые возможности

- `local-web-generation`: брейкпоинты типографики берутся из `.sdds/config.json`, если заданы.
- `cli-core`: project config принимает и сохраняет необязательное поле `breakpoints`.

## Влияние

- `js/cli`: `src/local-theme-source.ts`, `src/theme-source.ts`, `src/generate-theme.ts`,
  `src/generator/themeBuilder/` (генераторы `generateThemes`, `generateCSSThemes`,
  `generateCSSModuleThemes`, `generate.ts`), тесты `src/theme.test.ts`.
- `frontend-kt`: `core-workspace` (`ProjectConfig`, тест кодека). Адаптер `platform-web` не меняется —
  он уже передаёт генератору каталог `.sdds`.
- `backend-kt`, db-service, API и хранение данных не затрагиваются.
