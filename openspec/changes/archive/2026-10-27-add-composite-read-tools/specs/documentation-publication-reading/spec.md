## MODIFIED Requirements

### Requirement: Чтение и listing CodeBinding

Сервис SHALL сохранять чтение CodeBinding по ID и постраничный список с subject/kind/name. Без новых параметров SHALL возвращаться полный прежний payload. Необязательные detail и точные фильтры SHALL применяться на сервере.

#### Scenario: Exact binding прочитана

- **WHEN** клиент читает существующий binding без detail и новых фильтров
- **THEN** ответ MUST сохранить канонические поля и полный platformPayload

#### Scenario: Listing отфильтрован по subject

- **WHEN** передан subject=components.avatar
- **THEN** список MUST содержать только bindings с точным subject и прежней формой items/nextCursor

#### Scenario: Семантика поиска имени сохранена

- **WHEN** передан прежний name
- **THEN** фильтр MUST сохранить регистронезависимую подстрочную семантику
- **WHEN** передан exactName
- **THEN** сравнение MUST быть точным, а сочетание с name MUST дать INVALID_QUERY

#### Scenario: Серверная проекция

- **WHEN** listing получает detail=summary
- **THEN** items MUST содержать компактные метаданные без полного platformPayload
- **WHEN** точный binding получает detail=summary
- **THEN** ответ MUST содержать оформления, оси, defaults и counts без развёрнутых вариаций/styleApi
- **WHEN** detail=variations
- **THEN** ответ MUST содержать выбранные варианты и ссылки кода без styleApi
- **WHEN** detail=full
- **THEN** ответ MUST сохранить полный payload после фильтров

#### Scenario: Точные имена вариантов

- **WHEN** переданы appearanceNames или variationNames
- **THEN** сервер MUST фильтровать точные непрозрачные имена без интерпретации фиксированных осей
- **WHEN** detail=summary передан вместе с variationNames
- **THEN** сервер MUST вернуть INVALID_QUERY

#### Scenario: Совместимость продолжения bindings

- **WHEN** клиент передал прежний строковый ID-cursor
- **THEN** сервер MUST сохранить возможность продолжения по прежним правилам
- **WHEN** сервер выдаёт новый непрозрачный строковый cursor
- **THEN** он MUST быть привязан к публикации и фильтрам без изменения типа nextCursor

## ADDED Requirements

### Requirement: Список опубликованных выпусков документации

Сервис SHALL предоставлять GET publications с designSystemId, необязательными version/platform и пагинацией, возвращая опубликованные выпуски, включая переиздания, новые первыми. Формат SHALL быть items/nextCursor, лимиты 20/100.

#### Scenario: Обнаружение публикаций

- **WHEN** точные версия и платформа неизвестны
- **THEN** список MUST вернуть доступные публикации указанной DS с version/platform/publicationId и временем публикации
- **THEN** candidate MUST отсутствовать, а сортировка MUST иметь стабильный дополнительный ID

#### Scenario: Продолжение и доступ

- **WHEN** cursor повторно используется с другим проектом, DS или фильтрами
- **THEN** новая операция MUST вернуть INVALID_QUERY
- **WHEN** публикации недоступны actor
- **THEN** существующие project-scoped проверки MUST сохраняться без раскрытия чужих выпусков

### Requirement: Сохранение существующих входов чтения публикаций

Сервис SHALL сохранять active publication и ID-маршруты navigation/page/bindings и передавать фактический контекст в X-DS-Read-Context без изменения тела. Отдельный вход по составному селектору SHALL NOT требоваться.

#### Scenario: Чтение по номеру и платформе

- **WHEN** клиент сначала разрешил точные version/platform через publications/active
- **THEN** чтение по полученному publicationId MUST оставаться допустимым после смены active pointer, пока публикация доступна
- **THEN** navigation и page MUST сохранять порядок content, subjects и assets

#### Scenario: Независимость от версии модели

- **WHEN** документация опубликована, но одноимённая версия модели отсутствует
- **THEN** чтение MUST оставаться доступным
- **THEN** контекст MUST содержать её version/platform/publicationId и фактическую DS без выдуманного versionId модели

### Requirement: Компактный фрагмент и доказуемая связь с моделью

kb/fetch SHALL поддерживать detail=compact без searchText; отсутствие detail SHALL сохранять полный прежний ответ. Binding SHALL содержать componentId только при доказанном соответствии модели.

#### Scenario: Полный или компактный фрагмент

- **WHEN** detail отсутствует или равен full
- **THEN** ответ MUST сохранить searchText и прочие прежние поля
- **WHEN** detail=compact
- **THEN** markdown и метаданные MUST сохраниться без копии поискового индекса

#### Scenario: Соответствие не установлено

- **WHEN** нет доказанного однозначного соответствия binding и компонента выбранной модели
- **THEN** componentId MUST отсутствовать без сопоставления по похожему имени
- **THEN** документация MUST NOT представляться состоянием авторитетной модели
