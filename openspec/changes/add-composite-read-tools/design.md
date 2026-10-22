# Проектное решение

## Контекст и зависимости

Зависит от `add-versioned-read-tools`, который поставляет общий выбор версии, HTTP-заголовки, совместимую пагинацию модели и промежуточные 22 tools. Не зависит от `use-pkce-for-cli-mcp`. Мотивация — в proposal.md. Ни старые HTTP-тела, ни платформы, ни схема JS db-service не заменяются.

Архитектурный источник — `agent-architecture-handoff.md`: сложная предметная сборка выполняется общими backend-операциями. MCP идёт через Gateway, будущий Agent Service — через внутренний HTTP с доверенными actor/project/scopes; frontend feature-модули не становятся библиотекой Agent Service. Новый Agent Service вне scope.

## Составные операции и границы слоёв

```mermaid
flowchart LR
    MCP[MCP] --> Gateway[Gateway]
    Gateway --> Operation[Прикладная операция execute]
    Agent[Будущий Agent Service] -. внутренний HTTP .-> Operation
    Operation --> Repository[Порты и существующие сборщики]
    Repository --> DB[(Одна read-only транзакция)]
```

Сохраняются presentation → application → domain, data и di. У каждого нового/изменённого UseCase ровно один публичный execute. Общие механизмы оформляются сервисами; feature-to-feature зависимости не вводятся. Проверки доступа и целостности переиспользуются, обязательный designSystemId в каждую старую ID-ручку не добавляется. Не вводится новый запрет чтения доступного ресурса другой DS из-за локального контекста tool.

## Конфигурация и токен-ссылки

Существующий `POST DS/component-config/export` расширяется альтернативным componentId и selection. При componentId designSystemId сохраняется, platform определяется по компоненту; явно несовместимая платформа отклоняется. Старые platform/components/styles продолжают работать. componentId и фильтр components вместе отклоняются. Необязательный style MCP передаёт как существующий styles=[style]. Новые ID-запросы применяют selection — JSON-объект ось→значение; существующий полный экспорт без selection не ограничивается. Тело успешного ответа остаётся прежним пакетом meta/components/underivedTypes, без обёрток и ограничений списка.

Выбор версии разрешается один раз, сборка и проверка осей выполняются в согласованной read-only транзакции подходящей изоляции. Частичный selection допустим: выбранные оси сужаются, остальные сохраняются. Неизвестные оси/значения и неоднозначность дают INVALID_QUERY. Существующий builder переиспользуется; полная конфигурация не собирается из каталогов на клиенте.

Новая операция `POST DS/component-config/tokens/query` принимает designSystemId, componentId, необязательные styles и обязательный selection. Требуется полный выбор осей всех выбранных оформлений. Ответ содержит items со стабильными tokenId, именами и путями использования; произвольные строки не объявляются токенами. Ссылки проверяются по каталогу той же версии, значения темы не вычисляются. Version остаётся query-параметром; фактическая граница передаётся X-DS-Read-Context.

## Обогащение существующих чтений

Параметр include существующих ID-маршрутов включает дополнительные поля, не меняя прежний ответ без параметра:

- variations: `include=values,defaults` — допустимые значения и имеющиеся defaults выбранной модели;
- properties: `include=platformParams` — существующие платформенные параметры свойств;
- deps: `include=reuseConfig` — настройки переиспользования выбранной DS; метаданные родителей/детей уже есть и не реализуются повторно.

MCP №15–17 явно включает нужные данные. Где ресурс глобальный, а расширение зависит от DS, запрос расширения принимает designSystemId и использует существующую проверку связи; это не новый обязательный параметр всех старых чтений. Платформы компонентов web/compose/xml/ios и токенов web/android/ios сохраняются.

## Публикации документации

Документация имеет независимые version/platform/publicationId. Новая операция `GET DOC/publications` возвращает существующий для документационных списков объект items/nextCursor с опубликованными выпусками выбранной DS, включая переиздания, новые первыми; candidate исключаются. Фильтры version/platform необязательны, limit по умолчанию 20 и максимум 100. Cursor непрозрачный и привязан к проекту/DS/фильтрам/порядку. Модельная публикация с тем же номером не требуется.

Все остальные маршруты сохраняются: publications/active; publications/{publicationId}/navigation; pages/{path}; bindings и bindings/{bindingId}; search; kb/fetch. Без явного ID MCP требует точные version/platform из аргументов или контекста, отклоняет draft и не использует серверную возможность latest. Сначала разрешается active publication, затем читается конкретный ID. Эти два простых HTTP-вызова допустимы; дополнительных /navigation, /pages или /bindings по селектору не создаётся. По явному ID выполняется один запрос, его фактические метаданные не блокируются унаследованными параметрами другой публикации; явно несовместимые параметры отклоняются.

401/403/503 разрешения не превращаются в PUBLICATION_NOT_FOUND. Недоступность проекта и существующие проверки принадлежности публикации сохраняются. Дополнительный обязательный DS-фильтр всех ID-ресурсов не вводится; фактическая DS видна в контексте. Нельзя объявлять документацию авторитетной моделью или выводить componentId по похожему имени; поле допустимо только при доказанном соответствии.

X-DS-Read-Context для документации содержит designSystemId/version/platform/publicationId из фактической публикации; versionId модели отсутствует. Список разных публикаций содержит только designSystemId. HTTP-тела сохраняются, метаданные не содержат credentials или внутренних URL.

## Поиск и совместимость cursor

Существующий search принимает несколько повторяющихся subject, числовой offset cursor и возвращает items/nextCursor с прежним числовым типом. Добавляется явный publicationId. Первая страница по version/platform возвращает фактический ID в заголовке; следующие MCP-запросы передают этот ID и исходные query/subjects. Смена active pointer не переключает публикацию.

Числовой cursor не объявляется непрозрачным привязанным ко всем фильтрам токеном: статической гарантии такой привязки при сохранении типа нет. Изменение фильтров начинает новый поиск. Ограничения candidate window, ранжирование, eval corpus и телеметрия без raw query сохраняются. Существующий HTTP без publicationId продолжает разрешать active publication как раньше.

Bindings listing сохраняет строковый nextCursor, его тип и items; cursor может стать непрозрачным и привязываться к публикации/фильтрам. Для совместимости сервер принимает прежнюю ID-форму cursor по старому правилу; выдаёт новую привязанную форму для продолжения, не меняя тип. `name` сохраняет регистронезависимую подстроку; необязательный `exactName` даёт точное имя, name вместе с exactName — INVALID_QUERY. Subject/kind уже поддержаны и не добавляются заново. Лимиты документации остаются 20/100.

## Серверные проекции с явным включением

Bindings listing получает `detail=summary|full`, без detail остаётся full; MCP явно запрашивает summary. Точная привязка получает detail=summary|variations|full и appearanceNames/variationNames (повторяющиеся параметры). Без detail и новых фильтров старый HTTP возвращает full. MCP без detail/variationNames передаёт summary; с variationNames без detail передаёт variations. Явный summary вместе с variationNames отклоняется. Summary содержит оформления, оси, defaults и counts без развёрнутых вариаций/styleApi; variations — выбранные непрозрачные имена вариантов и ссылки кода без styleApi; full — исходный payload после фильтрации. AppearanceNames/variationNames точные, не раскладываются на выдуманные оси. Для token-binding не изобретаются компонентные вариации.

`GET DOC/kb/fetch` получает `detail=full|compact`; без него ответ прежний с searchText, MCP явно передаёт compact. kbUrl определяет публикацию и сохраняет её при переиздании. Это исключение копии индекса, а не изменение markdown.

## Итоговый реестр и владельцы

Все 26 tools имеют необязательный designSystem. V — модельная версия; P — publicationId либо точные version/platform; L — пагинация с правилами соответствующего сервиса. Идентификаторы обязательны, если не отмечено иное.

| № | Tool | Параметры сверх designSystem | Владелец |
|---|---|---|---|
| 1 | design_system_get_context | V | add-versioned-read-tools |
| 2 | project_get_status | — | Сохранение в первом Change |
| 3 | design_system_versions_list | L | Первый Change |
| 4 | design_system_version_get | V | Первый Change |
| 5 | design_system_changes_list | V, L | Первый Change |
| 6 | tenants_list | V, name/query, L | Первый Change |
| 7 | tokens_list | V, type, name/query, groupId, L | Первый Change |
| 8 | token_get | V, tokenId | Первый Change |
| 9 | token_values_get | V, tokenId, tenantId?, mode?, platform? | Первый Change |
| 10 | token_groups_list | V, kind=color, parentId?, L | Первый Change |
| 11 | palette_get | V, tenantId, groupId?, type?, shade? | Первый Change |
| 12 | components_list | V, name/query, platform?, L | Первый Change |
| 13 | component_get | V, componentId | Первый Change |
| 14 | component_styles_get | V, componentId, name?, L | Первый Change |
| 15 | component_variations_get | V, componentId | Первый Change: чтение; этот Change: обогащение |
| 16 | component_properties_get | V, componentId | Этот Change, новый tool |
| 17 | component_dependencies_get | V, componentId | Этот Change, новый tool |
| 18 | component_config_get | V, componentId, style?, selection? | Этот Change, изменение прежнего tool |
| 19 | component_tokens_get | V, componentId, style?, selection | Этот Change, новый tool |
| 20 | documentation_publications_list | version?, platform?, L | Этот Change, новый tool |
| 21 | documentation_search | P, query, subjects[]?, L | Этот Change, изменение прежнего tool |
| 22 | documentation_fetch | kbUrl | Этот Change, изменение прежнего tool |
| 23 | documentation_get_navigation | P | Этот Change, изменение прежнего tool |
| 24 | documentation_get_page | P, path | Этот Change, изменение прежнего tool |
| 25 | code_binding_search | P, subject?, kind?, name?, L | Этот Change, изменение прежнего tool |
| 26 | code_binding_get | P, bindingId, detail?, appearanceNames[]?, variationNames[]? | Этот Change, изменение прежнего tool |

Name в code_binding_search сохраняет подстрочную семантику. Точные appearanceNames/variationNames принадлежат code_binding_get. Исходные 16 имён сохраняются, первый Change добавляет шесть, этот — четыре. Оба launcher имеют один реестр, все аннотации read-only; служебные auth-команды не являются tools.

## Программное проектирование

```kotlin
interface ComponentSelectionService {
    fun select(config: ComponentConfig, selection: Map<String, String>): ComponentSelectionResult
}
interface TokenReferenceReader {
    suspend fun read(context: SelectedReadContext, query: ComponentTokenQuery): TokenReferenceResult
}
```

Прикладные операции имеют отдельные UseCase.execute. MCP не строит config из экспорта и каталога, не фильтрует platformPayload и не вычисляет значения темы. Простое разрешение publicationId остаётся HTTP-оркестрацией.

## Выпуск и проверки

Сначала аддитивные API и OpenAPI, затем версия MCP с описанием несовместимых схем. Прежние HTTP-запросы, тела и полный экспорт остаются; rollback MCP не требует миграции БД. Проверяются прежние ответы без параметров и проекции по явному запросу, отсутствие новых enum платформ, конкурентное составное чтение, историческая модель, независимая документация и переиздания, отказ доступа без утечки и сохранение 401/403/503.

FAST → независимое read-only review → FULL, граф shared MCP и npm tarball вне Gradle, затем внешние чтения всех 26 tools обоими launcher с scopes и переизданием документации. Недоступная инфраструктура не считается пройденной проверкой. Этот документ не разрешает реализацию, архивирование или публикацию в текущем запросе.
