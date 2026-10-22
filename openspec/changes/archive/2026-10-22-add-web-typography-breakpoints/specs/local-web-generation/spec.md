## ADDED Requirements

### Requirement: Брейкпоинты типографики из project config

`npm run generate:theme` и `npm run generate:ds` SHALL брать брейкпоинты медиазапросов адаптивной
типографики из необязательного массива `breakpoints` в `.sdds/config.json`. Элемент массива SHALL
быть объектом с полем `name` — одним из `screenS`, `screenM`, `screenL` — и необязательными целыми
неотрицательными границами `from` и `to` в пикселях, где отсутствующий ключ и `null` означают
отсутствие границы. `from` SHALL означать минимальную ширину экрана, `to` — максимальную. Медиазапрос
SHALL строиться так: только `to` — `@media (max-width: <to>px)`, `from` и `to` —
`@media (min-width: <from>px) and (max-width: <to>px)`, только `from` — `@media (min-width: <from>px)`.
В темах SHALL выводиться типографика только описанных в массиве экранов, в порядке массива.

#### Scenario: Брейкпоинты заданы

- **WHEN** в `.sdds/config.json` задано `"breakpoints": [{ "name": "screenS", "to": 959 }, { "name": "screenM", "from": 960, "to": 1280 }, { "name": "screenL", "from": 1281 }]` и разработчик запускает `generate:theme`
- **THEN** типографика `screenS` MUST быть обёрнута в `@media (max-width: 959px)`
- **THEN** типографика `screenM` MUST быть обёрнута в `@media (min-width: 960px) and (max-width: 1280px)`
- **THEN** типографика `screenL` MUST быть обёрнута в `@media (min-width: 1281px)`
- **THEN** это MUST выполняться в `themes/<имя>__dark|light.ts`, `css/<имя>__dark|light.css` и `css/<имя>.module.css` каждой сгенерированной темы

#### Scenario: Брейкпоинты не заданы

- **WHEN** `config.json` отсутствует или в нём нет `breakpoints`
- **THEN** содержимое `src/theme` MUST быть таким же, как до изменения: ≤559, 560–959 и ≥960 px

#### Scenario: Описана часть экранов

- **WHEN** в `breakpoints` описаны только `{ "name": "screenS", "to": 767 }` и `{ "name": "screenL", "from": 768 }`
- **THEN** в темах MUST быть медиазапросы только для `screenS` и `screenL`
- **THEN** типографика `screenM` MUST NOT выводиться в файлах темы

#### Scenario: Один экран

- **WHEN** в `breakpoints` описан один экран без границ
- **THEN** его типографика MUST выводиться в селекторе темы без медиазапроса

#### Scenario: Нулевые границы

- **WHEN** в `breakpoints` задано `[{ "name": "screenS", "to": 0 }, { "name": "screenM", "from": 0, "to": 959 }, { "name": "screenL", "from": 960 }]`
- **THEN** типографика `screenS` MUST быть обёрнута в `@media (max-width: 0px)`
- **THEN** типографика `screenM` MUST быть обёрнута в `@media (min-width: 0px) and (max-width: 959px)`
- **THEN** граница `0` MUST NOT теряться и MUST NOT давать блок без медиазапроса

#### Scenario: Одна тема

- **WHEN** брейкпоинты заданы и разработчик передаёт `--tenant <name>`
- **THEN** CLI MUST применить те же брейкпоинты к этой теме

### Requirement: Согласованность брейкпоинтов

CLI SHALL проверять, что у сетки `breakpoints` есть начало и конец, а у промежуточных экранов
заданы обе границы, и SHALL завершаться ошибкой, называющей путь к `config.json` и номер элемента,
до изменения каталога результата.

#### Scenario: Сетка согласована

- **WHEN** у первого экрана задан только `to`, у последнего только `from`, у остальных обе границы с `from ≤ to`
- **THEN** генерация MUST завершиться успешно

#### Scenario: Нет начала или конца сетки

- **WHEN** у первого экрана задан `from` или у последнего задан `to`
- **THEN** CLI MUST завершиться ошибкой

#### Scenario: Промежуточный экран без границы

- **WHEN** у экрана между первым и последним не задана одна из границ или `from > to`
- **THEN** CLI MUST завершиться ошибкой

#### Scenario: Соседние экраны не стыкуются

- **WHEN** начало экрана не равно концу предыдущего плюс 1, например `{ "name": "screenS", "to": 700 }` и `{ "name": "screenM", "from": 960, "to": 1280 }`
- **THEN** CLI MUST NOT считать это ошибкой и MUST сгенерировать медиазапросы по заданным границам

#### Scenario: Неверный состав массива

- **WHEN** `breakpoints` не массив или пустой, элемент не объект, `name` не из `screenS`, `screenM`, `screenL`, имя повторяется или нарушен порядок `screenS`, `screenM`, `screenL`, либо граница не целое неотрицательное число
- **THEN** CLI MUST завершиться ошибкой
- **THEN** CLI MUST NOT изменять каталог результата
