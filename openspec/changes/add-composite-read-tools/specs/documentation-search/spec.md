## MODIFIED Requirements

### Requirement: Ограничение поиска active publication и filters

Поиск SHALL принимать designSystemId, query, subjects и точные version/platform либо явный publicationId. Он MUST искать только в доступной опубликованной публикации доверенного проекта, сохраняя действующий ответ и числовой cursor.

#### Scenario: Subject filter указан

- **WHEN** клиент передаёт один или несколько повторяющихся subject
- **THEN** оба поисковых канала MUST вернуть результаты, связанные с этими subjects

#### Scenario: Active publication отсутствует

- **WHEN** запрос без publicationId не находит active publication по точным version/platform
- **THEN** поиск MUST вернуть 404 Not Found

#### Scenario: Явная публикация

- **WHEN** передан publicationId доступной опубликованной публикации
- **THEN** поиск MUST выполняться в ней, даже если active pointer сменился
- **WHEN** явно переданные version/platform несовместимы с ID
- **THEN** сервер MUST вернуть INVALID_QUERY

#### Scenario: Совместимость прежнего запроса

- **WHEN** publicationId отсутствует
- **THEN** прежнее разрешение active publication MUST сохраниться
- **THEN** лимиты 20/100, candidate window, ранжирование и форма items/nextCursor с числовым продолжением MUST сохраниться

## ADDED Requirements

### Requirement: Закрепление публикации поиска через метаданные

Поиск SHALL возвращать X-DS-Read-Context с фактической DS, version/platform/publicationId. Продолжение по явному ID SHALL сохранять выбранную публикацию без требования одноимённой версии модели.

#### Scenario: Переиздание между страницами

- **WHEN** после первой страницы active pointer сменился
- **THEN** запрос следующей страницы с publicationId первого ответа и исходными query/subjects MUST искать в прежней доступной публикации
- **THEN** сервис MUST NOT переключить его на новый active pointer

#### Scenario: Предел гарантий числового cursor

- **WHEN** клиент продолжает поиск
- **THEN** он MUST сохранять исходные фильтры и передавать выбранный publicationId
- **THEN** числовой cursor MUST NOT объявляться непрозрачным токеном, доказанно привязанным ко всем фильтрам
- **WHEN** фильтры изменились
- **THEN** клиент MUST начинать новый поиск с первой страницы

#### Scenario: Чужая публикация и качество поиска

- **WHEN** publicationId недоступен доверенному проекту либо не опубликован
- **THEN** поиск MUST вернуть NOT_FOUND без чужих результатов
- **WHEN** запускается регрессионный корпус
- **THEN** ранжирование, отсутствие внешнего inference и принятые показатели качества MUST сохраняться
