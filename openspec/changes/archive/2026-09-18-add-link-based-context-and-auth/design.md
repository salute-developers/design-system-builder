## Context

Сегодня `ContextResolver` получает контекст только из ближайшей `.sdds/config.json`; MCP tools используют общий `workspace`, а `ProjectContext` содержит обязательный `configPath` и имя env-переменной с ключом. Общий `RuntimeCredentialProvider` выбирает project key, затем user session, но `docs publish`, `themes` и `components` используют отдельный key-only port. Gateway уже различает Bearer user и project key на project-scoped маршрутах; downstream-права требуют проверки. ADR-0005 предусматривает явный контекст, но он не реализован.

## Goals / Non-Goals

**Goals:**

- Дать CLI и MCP одинаковый явный контекст без `.sdds`, сохранив локальный сценарий.
- Изолировать контекст каждого MCP вызова и сделать выбор credential детерминированным.
- Поддержать user session для любой авторизованной CLI-команды с backend-проверкой прав.
- Сохранить поведение существующих конфигов и не хранить секреты в ссылках/конфиге.

**Non-Goals:**

- Авторизация по самой ссылке, передача токена через URL или автоматический login во время MCP `tools/call`.
- Глобальное изменяемое состояние «текущая дизайн-система» в процессе MCP.
- Удаление `.sdds`, изменение локальных путей генерации и обход backend RBAC.
- Добавление нового сервиса, хранилища или схемы БД.
- Изменение backend routes, gateway policy или UI в `js/apps/client`; этот change реализует link/context и credential selection в CLI/MCP.

## Decisions

### Общий явный контекст

В `core-domain` вводится тип входного `DesignSystemSelection` с `projectId`, `designSystemId`, `version`, `platform` и provenance. `configPath` и credential policy относятся к локальному источнику и не должны быть обязательными полями идентичности дизайн-системы. `core-application` принимает явный selection перед цепочкой локальных `ContextSource`; ошибка разбора явного selection прекращает разрешение, не переключая запрос на `.sdds`. Отсутствующая `.sdds` для headless-вызова трактуется как `NotFound`, а не как фатальная ошибка источника.

Read use cases принимают один `RuntimeRequest` с `ContextSelection.Local` или `ContextSelection.Link`, API URL override и key override. Общий `RuntimeRequestResolver` разрешает контекст, API URL и credential один раз на вызов и передаёт типизированный результат предметному сценарию. Legacy реализации портов, которые не поддерживают ссылку или forced credential policy, возвращают явную ошибку и не подменяют выбранный контекст либо actor.

Первая версия переносимой ссылки — `dsbuilder://projects/{projectId}/design-systems/{designSystemId}?version={version}&platform={platform}`. Parser работает локально, не разыменовывает URL, запрещает userinfo, fragment, неизвестный host/path и повторяющиеся поля. Ссылка не задаёт API URL: он по-прежнему разрешается существующим `ApiUrlResolver`. UI Builder сможет копировать такую ссылку независимо от своего текущего маршрута; будущая поддержка HTTPS URL страницы потребует отдельной доверенной схемы сопоставления origin с API.

Контракт v1: `projects` — точный authority URI, путь состоит ровно из трёх сегментов `/{projectId}/design-systems/{designSystemId}`. Оба ID — непустые ASCII URL-safe identifiers из букв, цифр, `_` и `-`; это не display names. `version` и `platform` обязательны ровно по одному разу. Version — непустая строка из букв, цифр, `.`, `_`, `-` и `+`; platform — одно из `compose`, `android-view`, `swiftui`, `react`. Пустые значения, неизвестные query fields, userinfo, port, fragment, дополнительные сегменты, encoded slash и некорректное percent-encoding запрещены. Canonical serializer выдаёт параметры в порядке `version`, `platform`, без секретов и API URL. URI выбирает контекст публикации; model/token endpoints остаются источником текущего состояния и не объявляются версионированными только из-за наличия URI.

Ошибки presentation имеют стабильные коды `CONTEXT_REQUIRED` (нет URI и локального контекста), `INVALID_CONTEXT` (явный URI не соответствует грамматике), `AMBIGUOUS_CONTEXT` (для чтения публикации не определены version/platform), `AUTH_REQUIRED` (нет credential выбранного типа), `FORBIDDEN` (backend отказал actor). MCP использует существующий `McpToolResult(isError=true, body=McpToolError(code,message,details))`; CLI печатает безопасное сообщение в stderr и завершает команду с code 1. Ни один error DTO не содержит raw URI с query, key, Bearer token или session data. `401`/`403` после выбора credential не запускают повтор от другого actor.

Альтернатива — передавать четыре отдельных ID в каждом инструменте. Она точна, но неудобна для передачи человеком в чат. Альтернатива — mutable `select_design_system` — отвергнута из-за параллельных чатов в одном MCP-процессе. В первой версии полный URI передаётся в каждом вызове; session-local `contextRef` не вводится до измерения реальных накладных расходов.

### MCP и CLI presentation

MCP launchers могут стартовать без workspace. Инструменты, читающие проектные данные, принимают optional `designSystem` URI; при наличии он имеет приоритет над workspace. `design_system_get_context` нормализует и показывает использованный контекст и provenance. Все результаты и ошибки сохраняют прежний DTO boundary. Отсутствие контекста сообщает `CONTEXT_REQUIRED`, неоднозначность version/platform — `AMBIGUOUS_CONTEXT`; отсутствующие значения не заменяются `0.0.0`/`web`.

Project-scoped CLI-команды получают общий optional `--design-system <uri>` через presentation; не каждая локальная команда должна принимать его. Команды с исходниками или archive сохраняют обязательный локальный путь. `--design-system` определяет удалённую цель, а не рабочую директорию. Если явная ссылка противоречит локальной `.sdds`, запрос использует ссылку, но не заимствует из случайной `.sdds` её credential policy.

Для `theme fetch` при выборе по ссылке без локальной `.sdds` CLI принимает необязательный `--destination <directory>` как явный локальный каталог записи. В этом режиме команда требует destination, создаёт там новую `.sdds/config.json` с идентификаторами из ссылки и ссылкой на выбранный тип credential, затем записывает темы. Существующий config в destination не перезаписывается. При обычном локальном вызове destination не нужен и используется найденный config.

### Credential policy

Локальный config поддерживает `credential.type = "auto"`, `"user-session"`, `"project-key-env"`. Существующий `"env"` с `name` читается как совместимый `auto` с тем же именем env. В `auto` key используется только если значение доступно до запроса; при отсутствии key выбирается session. В принудительных режимах используется только выбранный источник. После `401`/`403` actor не меняется; разрешён лишь refresh и повтор с той же user session в рамках существующего lifecycle.

Для явной ссылки без локального конфига интерактивное умолчание — user session для выбранного API URL. Для CI project key выбирается явно через параметр с именем env-переменной, не через raw key в командной строке. CLI и MCP должны одинаково применять эту policy. Конкретные имена launcher/command options фиксируются в delta specs и проверяются help tests.

Authenticated HTTP result сохраняет числовой status. Общий client factory для CLI и MCP при `401` у Bearer принудительно разрешает новую user session и повторяет тот же GET, POST или multipart POST один раз. Повторный `401` удаляет session; `403` и отказ project key не вызывают refresh. Feature adapters отображают типизированный status в error code без разбора текста сообщения.

Альтернатива — всегда выбирать key перед session даже при явной ссылке — отвергнута: переменная из чужой рабочей директории могла бы незаметно менять actor. Альтернатива — хранить refresh token в `.sdds` — отвергнута из-за риска коммита и существующего per-API-URL session store.

### Авторизованные операции и слои

`core-application` предоставляет единый `CredentialProvider`, возвращающий project key или Bearer credential; `feature-*` use cases передают типизированный credential в data HTTP adapters. Presentation только разбирает URI и параметры; domain хранит selection/policy без SDK и HTTP types; data формирует Authorization header; di связывает реализации. Key-only порты удаляются из авторизованных feature use cases после миграции. Gateway и downstream routes проверяют user role или key scopes; клиент не выводит локальных решений о полномочиях.

Выбор вариаций компонента, проверка связей между осями и извлечение token references выполняются прикладным `ComponentConfigProjector` в `feature-components`. `ComponentReadUseCases.projectedConfig` разрешает runtime один раз и использует его для чтения конфигурации и каталога токенов. MCP разбирает входные параметры инструмента и сериализует результат сценария.

Ошибка выбора credential сохраняет категорию `AuthErrorCode` при переходе в feature read result и MCP error DTO. Недоступность token endpoint во время refresh возвращает `BACKEND_UNAVAILABLE`, не `AUTH_REQUIRED`.

## Risks / Trade-offs

- [Действующий backend route принимает только project key] → Проаудировать каждый затронутый route с user Bearer и исправить авторизацию до переключения CLI-команды.
- [Существующий `env` config может полагаться на key-only поведение конкретной команды] → Сохранить приоритет доступного key и покрыть миграцию compatibility tests.
- [Неверная ссылка или другой проект] → Строгий parser, backend-проверка project/design-system связи, отсутствие fallback на локальный контекст.
- [Длинный URI в каждом MCP вызове] → Сначала измерить стоимость; не вводить состояние или непрозрачный handle без необходимости.
- [Версия публикации и текущее состояние модели имеют разную семантику] → В ответах указывать фактический source/provenance; не объявлять системные токены версионированными без backend-контракта.

## Migration Plan

1. Добавить новый parser/selection и credential policy с чтением старого `env` config; не менять записи существующих файлов автоматически.
2. Перевести авторизованные feature use cases на общий credential contract; backend authorization остаётся внешним контрактом и проверяется аудитом без правок серверного кода.
3. Подключить явный URI к CLI и MCP, добавить контракты ошибок, concurrent-context и compatibility tests.
4. Обновить `dsbuilder init`, help, документацию и ADR-0005; проверить сборку и тесты frontend.

Rollback: новые URI-параметры и policy modes можно отключить, оставив чтение старого `env` config и key-based операции; миграции БД и перезаписи пользовательских конфигов нет.

## Open Questions

- Нужна ли в первом релизе кнопка копирования URI в `js/apps/client` или достаточно документированного формата до отдельного UI change?
- Должны ли `version` и `platform` быть обязательны для каждого URI, если конкретный tool читает только текущее состояние модели? Предпочтение — обязательны для детерминированного контекста, но не утверждать версионированность model API.
