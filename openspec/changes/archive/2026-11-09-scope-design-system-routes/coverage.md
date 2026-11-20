# Карта охвата чтения и записи

## Основание и пределы исследования

База: `7d948d60`, ветка `feature/ds-routes`. Статически сопоставлены все 38 файлов `*Routes.kt` в четырёх фичах, `runtime`/публичный вход приложения, OpenAPI, манифест, контекстные и бесконтекстные транзакционные входы. Далее прослежены общие запросы редакций, проверки принадлежности, устойчивые таблицы, обработчики пакетных операций и импорт. Карта фиксирует требуемое покрытие будущей реализации, а не результаты пока не написанных интеграционных тестов.

В `contracts/route-manifest.json` — 208 операций; в `runtime/src/main/resources/openapi/documentation.yaml` — 198. После нормализации имён path-параметров манифест содержит 13 лишних операций, а OpenAPI — три отсутствующих в манифесте. Поэтому манифест нельзя считать единственным перечнем работающих маршрутов.

В манифесте лишние: `DELETE /component-deps/{id}`, `/components/{id}`, `/properties/{id}`, `/property-platform-params/{id}`, `/property-variations/{id}`, `/states/{id}`, `/variations/{id}`, `PATCH` и `DELETE /design-system-versions/{id}`, а также четыре операции `/design-system-changes`. В OpenAPI и коде вместо старых операций журнала используются вложенные маршруты; к манифесту нужно добавить `GET /design-systems/{id}/changes/summary`, `GET /design-systems/{id}/events`, `POST /design-systems/{id}/changes/{changeId}/revert`. Не восстанавливать удалённые операции ради совпадения манифеста.

Административные `ApiMetaImportRoutes.kt` и параметризованный `PluginBuildRoutes.kt` проверены отдельно: они не перечислены как самостоятельные административные операции в этих 198 строках. Административный импорт API-меты и чтение/публикация сборок остаются глобальными.

## Границы и точки применения

Пути ниже указаны относительно `backend-kt/ds-service`, если не оговорено иное. Существующие проверки проекта сохраняются. «Добавить» означает требование к реализации, а не уже существующую защиту.

| Семейство | Чтения | Записи и пакеты | Где обеспечить ожидаемую систему |
|---|---|---|---|
| Дизайн-системы | Каталог, карточка, агрегаты компонентов/токенов/тем/оформлений | Создание системы, переименование, удаление с каскадом | `ExposedDesignSystemRepository`, `ExposedDesignSystemAggregateRepository`: карточка и агрегаты сопоставляют ID пути; каталог/создание системы не требуют заранее существующего ID |
| Версии | Список, детали, история | Публикация текущего черновика | `ExposedDesignSystemVersionRepository.publishedRows/accessible/owned`; до блокировки `ExposedPublicationTransactionRunner`; версии и черновик относятся к системе пути |
| Журнал | Лента, сводка, изменённые токены | Одиночный и пакетный откат | `ExposedDraftChangeRepository.boundary`, сырой SQL, `verifySnapshot/trackedSubjects`, обработчики зависимостей, savepoint; проверка всей пачки и версии |
| SSE | Курсор и поток событий | Нет предметной записи | `GetDesignSystemDraftCursorUseCase`, начальная/повторная проверка системы и фильтр `DraftInvalidationRoutes` |
| Токены | Списки, определение, значения с фильтрами | Создание/изменение/удаление определения, очистка ссылок | `ExposedTokenRepository.currentRows`, `ownedDesignSystem`, `draft`, `ExposedModelReadSelectionResolver`; создание проверяется до устойчивой вставки |
| Значения токенов | Списки и детали | Создание/изменение/удаление, правила значения | `ExposedTokenValueRepository.resolvedRows/currentTokenRows`, `createAllowed/validTenant`, блокировка/выбор черновика; глобальный `paletteId` проверяется прежней политикой |
| Темы | Списки/детали, значения темы и preview | Создание с начальными значениями, копия палитры, массовое `PUT token-values`, удаление | `ThemeRevisionQueries.currentTenantRows/currentThemeTokenRows/currentThemeTokenValueRows`, `ExposedTenantRepository.ownedDesignSystem/lockWritableTenant`, `TenantTokenValueInitializer`; все токены и тема одной системы |
| Палитры тем | Снимок, ссылки, шаблон, группы и шкалы | Группы, шкалы, исходный цвет, перестроение, шаги, перенос привязок | `ExposedTenantPaletteRepository.snapshot/lock`, helpers устойчивых/редакционных таблиц; проверить тему до прямых выборок и записи, включая каскады |
| Цветовые токены | Определения и ссылки для записи | Создание семейства, несколько режимов/платформ, перенос/удаление | `ExposedColorTokenRepository`, общие запросы темы; `tenantId`, `tokenId`, группы и ссылки принадлежат системе пути |
| Размеры | Список, использование в конфигурациях | Создание, значение, переименование, удаление | `ExposedSizeTokenRepository`, `ExposedSizeTokenUsageRepository`, очистка/перепривязка; проверка до создания значений для всех тем |
| Типографика | Стили, использование, параметры | Создание/изменение/удаление стиля, имени и целой группы | `ExposedTypographyStyleRepository`, `ExposedTypographyUsageRepository`, `RenameTypographyGroupUseCase`, общие запросы и записи; вся группа и зависимые ссылки ограничены системой |
| Группы токенов | Полный и постраничный список, родительские группы | Создание/порядок/переименование/удаление, инициализация | `ExposedTokenGroupRepository.accessible`, `TokenGroupsTable`, SQL страницы, `arrange/rename/delete` по устойчивым UUID и `TokenGroupRevisions`; обычного фильтра тем недостаточно |
| Подключения компонентов | Список и детали связи | Подключение и отключение компонента | `ExposedDesignSystemComponentRepository`, устойчивые строки до редакций; глобальный componentId допустим по прежним правилам |
| Оси и стили | Списки/детали, стили и свойства оси | Создание/изменение оси, стили; разрешённые операции по фактической регистрации | `ExposedComponentModelRepository`, `ExposedStyleRepository`, `VariationWrites`, `ComponentOwnership`, `resolvedRevisionSql`; `property-variations` проверяется через системную ось, хотя сама таблица не является редакционной |
| Конфигурации компонентов | Список, детали, editor-model, оси и эффективные свойства | Создание, дублирование, порядок осей/значений/состояний, каскадное удаление | `ExposedAppearanceRepository`, `EditorSupport`, `AppearanceEditor*Operations`, `EditorWrites`, устойчивые таблицы; источник дублирования и каждый дочерний UUID проверяются до копирования/изменения |
| Значения свойств | Инварианты, вариационные значения, фильтры по стилю/оформлению | Создание/изменение/удаление, корректировки платформы, ссылки на другие конфигурации | `ExposedPropertyValueRepository`, `ExposedComponentModelRepository`, `StyleReferenceWriter`, общие предикаты владельца; tokenId/appearance/style/reference-target должны быть из той же системы, глобальные property/platform-param/state проверяются по компоненту |
| Комбинации | Списки, детали, члены комбинации | Комбинация и пакет её членов | `ExposedStyleCombinationRepository`, разрешённые редакции и устойчивые строки; проверка всех стилей, порядка и владельца комбинации |
| Переиспользование | Список/детали/by-dep, обогащение зависимости | Создание/изменение/удаление настройки | `ExposedComponentReuseConfigRepository`, системные предикаты; глобальная зависимость сама не становится системной |
| Выгрузка/адаптер | `GET component-config`, `POST export/web-adapter`, editor-bundle | Нет предметной записи | `ExposedComponentConfigRepository.get/export`, builder/reader, `ExposedComponentWebAdapterRepository`, `ExposedComponentEditorBundleRepository`; ID пути обязателен даже при поиске по имени и пустых фильтрах |
| Импорт конфигураций | Разрешение имён, ссылок, исходного состояния | Сохранение и `dryRun`, удаление отсутствующих элементов, отложенные завершения | `ImportComponentConfigUseCase`, `ExposedComponentConfigRepository.import`, `ComponentConfigImporter`, `ComponentConfigImportSync`; ожидание системы до входа в importer и при прямых устойчивых операциях |
| Глобальные определения | Компоненты, свойства, платформенные параметры, component-deps, состояния, state-sets, палитра | Только существующие разрешённые операции глобальной модели | `ExposedComponentRepository/DependencyRepository/StateRepository/PaletteRepository`, глобальные методы model-repository; не применять системное ограничение к самому каталогу |
| Административные операции | Сборки и активные плагины | Импорт API-метаданных, публикация сборок, начальные заполнения | Существующие административные/служебные разрешения; контекст системы отсутствует намеренно |

### Реализованные общие ограничения

`selectedVersionBoundary`, `resolvedRevisionSql`, системные методы `ComponentOwnership` и `lockDesignSystemMutation` применяют общий предикат; прямые проверки создания токенов/тем, версии, журнал и resolver чтений дополняют его для устойчивых строк и сырого SQL. `ProjectComponentDesignSystemsTable` и `ProjectDesignSystemComponentsTable` намеренно не ограничены системой запроса: они используются только для прежней проектной ACL глобальных компонентов/свойств/зависимостей. Предметные связи компонентов продолжают использовать ограниченный `DesignSystemComponentsTable`.

Система маршрута читается из `RoutingCall.pathParameters`: объединённые `call.parameters` в Ktor позволяют query-параметру перекрыть параметр пути. `dsTrustedHeaders` удаляет входящий служебный заголовок системы и формирует его заново из пути.

## Транзакционные исключения

`TransactionRunner.required(context)` и `readOnly(context)` покрывают основную часть сценариев. Найденные вызовы без контекста перечислены полностью для application-кода фич:

| Вход | Решение |
|---|---|
| `ImportComponentConfigUseCase`: `transactions.rollback(execute)` | Исправить на контекстную перегрузку; сейчас `dryRun` теряет транзакционные настройки |
| `ImportApiMetaUseCase`: `rollback(execute)`, `required { ... }` | Сохранить как глобальный административный сценарий |
| `GetActivePluginBuildUseCase`: `readOnly { ... }` | Сохранить как глобальное чтение |
| `PublishPluginBuildUseCase`: чтение сборки, предварительный импорт, фиксация и служебная запись через бесконтекстные транзакции | Сохранить глобальную область; не смешивать с публикацией дизайн-системы |
| `CreateDesignSystemVersionUseCase`: отдельный `PublicationTransactionRunner.required(context, designSystemId)` | Сопоставить ожидаемую систему до блокировки и сохранить контекст во вложенной предметной транзакции |

`ExposedTransactionRunner.rollback` сегодня имеет самостоятельную реализацию без `configure(context)`. Новая перегрузка должна использовать общий путь конфигурации/обработки ошибок и сохранять обязательный откат. Обновить поддельные транзакционные реализации, чтобы тесты не скрывали потерю контекста.

## Входные контракты после переноса

У системных маршрутов ожидаемая система определяется только путём. Дублирующий `designSystemId` исключается из входных DTO и query, в том числе создания, импорта/выгрузки и публикации. Сервер формирует внутренние команды из ID пути; поля внутренних команд и ответов, идентификаторы других сущностей в пакетах и отдельное создание самой системы сохраняются. Матрица клиентских полей в `list-contracts.md` относится к ответам и не требует сохранять дублирующее поле в запросах.

## Пакеты и неочевидные последствия

1. `PUT tenants/{id}/token-values`: проверять полный набор токенов до успешного сохранения; A/B-пакет не превращается в частично сохранённый A-пакет.
2. `CreateTenantUseCase`: начальные значения, инициализация палитры и групп остаются в одной ограниченной транзакции; отказ откатывает созданную тему.
3. Цвет/размеры/типографика: семейства, платформы, режимы, группы и значения для нескольких тем не обходят границу через производные UUID. Переименование/удаление не меняет ссылки B.
4. Палитра: перестроение шкалы и удаление группы затрагивают значения и привязки; проверка родительской темы не заменяет проверку переданных групп/токенов.
5. Редактор: порядок — пакет UUID, дублирование — копирование поддерева, каскадное удаление — запись зависимых редакций. Чужие элементы не отбрасываются молча.
6. Импорт: `associateBy` сохраняет нынешнее правило последнего одноимённого оформления. Проверка границы не должна менять правило, формат отчёта или интерпретацию переносимых `authoredId`. `ComponentConfigImportSync`, устойчивые таблицы и ссылки проверяются отдельно от `resolvedRevisionSql`.
7. Импорт имеет существующие глобальные последствия: `dependencies()` создаёт `component_deps`, разрешение состояний создаёт `state_sets`. Подтвердить прежние разрешения и полный откат этих последствий в `dryRun`/при отказе; новую модель глобальной авторизации этим изменением не вводить.
8. Журнал: одиночный/пакетный откат, зависимые обработчики и точки сохранения не могут прочитать/откатить изменение другой системы; принадлежность всех элементов проверяется вместе со снимком редакций.
9. Публикация: ожидаемая система, `designSystemId` команды и `draftId` должны совпасть по владельцу; неправильная граница не должна брать блокировку B.
10. Повторы: сохранить существующие механизмы `repeatableMutation`, `IdempotentCreateExecutor`, специализированные `import-component-config` и публикацию. Система из пути учитывается при сопоставлении команды: один и тот же ключ A/B даёт существующий конфликт, удаление ресурса, включая саму дизайн-систему A, не ломает повтор A: контекст устанавливается до сопоставления результата, а существование системы проверяется только перед новым выполнением. Отдельных правил обработки старых результатов и миграции хранилища повторов нет.
11. Бесконтекстные начальные заполнения и административные операции намеренно остаются бесконтекстными. Соединение после A должно иметь пустую ожидаемую систему для глобальной операции, затем корректно обслуживать B.

## Матрица проверок

Для каждого семейства выше нужны допустимый A, ресурс B того же проекта, C другого проекта и неизвестный UUID. Повторить с обычным участником и администратором. Для глобально доступной системы подтвердить чтение и прежний запрет записи. Для исторического чтения — версия A, версия B и курсор B. Для каждого пакета — все элементы A, смесь A/B, пустой пакет, существующие предметные ошибки. Отрицательный сценарий проверяет не только статус, но и отсутствие изменений устойчивых строк, редакций, журнала, повторяемых результатов и событий.

Глобальные endpoints проверяются отдельно: одинаковая доступность до/после системного запроса, прежние разрешения и формат. Системное обогащение свойств/зависимостей проверяется на новых системных путях; глобальный путь без ID системы не принимает параметры системного обогащения.

## Реестр адресов OpenAPI

`P = /api/projects/{projectId}`, `D = P/design-systems/{designSystemId}`, `G = P/design-systems/catalog`. В таблице для сопоставления показаны исторические остатки путей относительно удаляемого `/api/ds`; это описание исходного состояния, а не сохраняемый вход. Методы в строке сохраняются, если не оговорено объединение; новые мутации не создаются. Внутренний системный путь получается заменой `D` на `/api/design-systems/{designSystemId}`. Публичные глобальные пути переносятся под `G = P/design-systems/catalog` без ID системы; соответствующий внутренний путь получается заменой `G` на `/api/design-systems/catalog`. Например, `G/components` соответствует `/api/design-systems/catalog/components`. Для внутреннего каталога `/api/design-systems` используется публичный `P/design-systems`. Административные входы используют `/api/admin/...`. Прежний `/api/ds` исключается полностью, в том числе из регистрации, OpenAPI, полей префиксов манифеста и внутренней нормализации; алиасы и перенаправления отсутствуют.

Для глобального `/components/{id}/properties` и `/deps` сохраняется базовое чтение; системное обогащение обслуживается дополнительным путём `D/components/{id}/...`. Совпавшие списки и версии регистрируются один раз. Токены используют существующий `DesignSystemTokenSummaryResponse`, темы — существующий `TenantResponse` из `feature-themes`; матрица реально используемых полей находится в `list-contracts.md`. Этот реестр задаёт перенос; OpenAPI и манифест остаются источниками машинного контракта реализации.

| Методы | Исходный путь | Целевой публичный путь |
|---|---|---|
| GET, POST | `/design-systems` | P/design-systems |
| GET, PATCH, DELETE | `/design-systems/{id}` | D |
| GET | `/design-systems/{id}/components` | D/components |
| GET | `/design-systems/{id}/token-groups` | D/token-groups |
| GET | `/design-systems/{id}/tokens` | D/tokens |
| GET | `/design-systems/{id}/components/{componentId}/styles` | D/components/{componentId}/styles |
| GET | `/design-systems/{id}/components/{componentId}/editor-bundle` | D/components/{componentId}/editor-bundle |
| GET | `/design-systems/{id}/tenants` | D/tenants |
| GET | `/design-systems/{id}/appearances` | D/appearances |
| GET | `/design-systems/{id}/changes/summary` | D/changes/summary |
| GET | `/design-systems/{id}/changes/token-ids` | D/changes/token-ids |
| GET | `/design-systems/{id}/changes` | D/changes |
| GET, POST | `/design-system-versions` | D/versions |
| GET | `/design-system-versions/{id}` | D/versions/{id} |
| GET | `/design-system-versions/by-design-system/{designSystemId}` | D/versions (объединить список) |
| GET, POST | `/tenants` | D/tenants |
| GET, PATCH, DELETE | `/tenants/{id}` | D/tenants/{id} |
| GET, PUT | `/tenants/{id}/token-values` | D/tenants/{id}/token-values |
| GET | `/tenants/{tenantId}/palette` | D/tenants/{tenantId}/palette |
| GET | `/tenants/{tenantId}/palette/links` | D/tenants/{tenantId}/palette/links |
| POST | `/tenants/{tenantId}/palette/groups` | D/tenants/{tenantId}/palette/groups |
| PATCH, DELETE | `/tenants/{tenantId}/palette/groups/{groupId}` | D/tenants/{tenantId}/palette/groups/{groupId} |
| PUT | `/tenants/{tenantId}/palette/token-groups/{tokenId}` | D/tenants/{tenantId}/palette/token-groups/{tokenId} |
| POST | `/tenants/{tenantId}/palette/groups/{groupId}/ramps` | D/tenants/{tenantId}/palette/groups/{groupId}/ramps |
| DELETE | `/tenants/{tenantId}/palette/groups/{groupId}/ramps/{type}/{shade}` | D/tenants/{tenantId}/palette/groups/{groupId}/ramps/{type}/{shade} |
| PUT | `/tenants/{tenantId}/palette/groups/{groupId}/ramps/{type}/{shade}/source` | D/tenants/{tenantId}/palette/groups/{groupId}/ramps/{type}/{shade}/source |
| POST | `/tenants/{tenantId}/palette/groups/{groupId}/ramps/{type}/{shade}/rebuild` | D/tenants/{tenantId}/palette/groups/{groupId}/ramps/{type}/{shade}/rebuild |
| PATCH | `/tenants/{tenantId}/palette/groups/{groupId}/ramps/{type}/{shade}/steps/{step}` | D/tenants/{tenantId}/palette/groups/{groupId}/ramps/{type}/{shade}/steps/{step} |
| POST | `/tenants/{tenantId}/color-tokens` | D/tenants/{tenantId}/color-tokens |
| PUT | `/tenants/{tenantId}/color-tokens/{tokenId}/values` | D/tenants/{tenantId}/color-tokens/{tokenId}/values |
| DELETE | `/tenants/{tenantId}/color-tokens/{tokenId}` | D/tenants/{tenantId}/color-tokens/{tokenId} |
| POST | `/tenants/{tenantId}/color-tokens/{tokenId}/move` | D/tenants/{tenantId}/color-tokens/{tokenId}/move |
| POST | `/tenants/{tenantId}/token-groups` | D/tenants/{tenantId}/token-groups |
| PATCH, DELETE | `/tenants/{tenantId}/token-groups/{groupId}` | D/tenants/{tenantId}/token-groups/{groupId} |
| GET, POST | `/tenants/{tenantId}/typography-styles` | D/tenants/{tenantId}/typography-styles |
| PATCH, DELETE | `/tenants/{tenantId}/typography-styles/{tokenId}` | D/tenants/{tenantId}/typography-styles/{tokenId} |
| PATCH | `/tenants/{tenantId}/typography-styles/{tokenId}/name` | D/tenants/{tenantId}/typography-styles/{tokenId}/name |
| PATCH, DELETE | `/tenants/{tenantId}/typography-groups/{group}` | D/tenants/{tenantId}/typography-groups/{group} |
| GET, POST | `/tenants/{tenantId}/size-tokens` | D/tenants/{tenantId}/size-tokens |
| PUT | `/tenants/{tenantId}/size-tokens/{tokenId}/value` | D/tenants/{tenantId}/size-tokens/{tokenId}/value |
| DELETE, PATCH | `/tenants/{tenantId}/size-tokens/{tokenId}` | D/tenants/{tenantId}/size-tokens/{tokenId} |
| GET, POST | `/tokens` | D/tokens |
| GET, PATCH, DELETE | `/tokens/{id}` | D/tokens/{id} |
| GET | `/tokens/{id}/values` | D/tokens/{id}/values |
| GET, POST | `/token-values` | D/token-values |
| GET, PATCH, DELETE | `/token-values/{id}` | D/token-values/{id} |
| GET, POST | `/palette` | G/palette |
| GET, PATCH, DELETE | `/palette/{id}` | G/palette/{id} |
| GET | `/palette/by-type/{type}` | G/palette/by-type/{type} |
| GET | `/compose-preview/plugin` | G/compose-preview/plugin |
| GET | `/web-preview/plugin` | G/web-preview/plugin |
| GET, POST | `/components` | G/components |
| GET, PATCH | `/components/{id}` | G/components/{id} |
| GET | `/components/{id}/variations` | D/components/{id}/variations |
| GET | `/components/{id}/properties` | G/components/{id}/properties; D/components/{id}/properties для обогащения |
| GET | `/components/{id}/deps` | G/components/{id}/deps; D/components/{id}/deps для обогащения |
| GET, POST | `/design-system-components` | D/design-system-components |
| GET, DELETE | `/design-system-components/{id}` | D/design-system-components/{id} |
| GET, POST | `/component-deps` | G/component-deps |
| GET, PATCH | `/component-deps/{id}` | G/component-deps/{id} |
| GET, POST | `/component-reuse-configs` | D/component-reuse-configs |
| GET, PATCH, DELETE | `/component-reuse-configs/{id}` | D/component-reuse-configs/{id} |
| GET | `/component-reuse-configs/by-dep/{componentDepId}` | D/component-reuse-configs/by-dep/{componentDepId} |
| GET, POST | `/variations` | D/variations |
| GET, PATCH | `/variations/{id}` | D/variations/{id} |
| GET | `/variations/{id}/styles` | D/variations/{id}/styles |
| GET | `/variations/{id}/properties` | D/variations/{id}/properties |
| GET, POST | `/properties` | G/properties |
| GET, PATCH | `/properties/{id}` | G/properties/{id} |
| GET, POST | `/property-platform-params` | G/property-platform-params |
| GET, PATCH | `/property-platform-params/{id}` | G/property-platform-params/{id} |
| GET, POST | `/property-variations` | D/property-variations |
| GET | `/property-variations/{id}` | D/property-variations/{id} |
| GET, POST | `/variation-platform-param-adjustments` | D/variation-platform-param-adjustments |
| GET, PATCH, DELETE | `/variation-platform-param-adjustments/{id}` | D/variation-platform-param-adjustments/{id} |
| GET, POST | `/invariant-platform-param-adjustments` | D/invariant-platform-param-adjustments |
| GET, PATCH, DELETE | `/invariant-platform-param-adjustments/{id}` | D/invariant-platform-param-adjustments/{id} |
| GET, POST | `/appearances` | D/appearances |
| GET, PATCH, DELETE | `/appearances/{id}` | D/appearances/{id} |
| GET | `/appearances/{id}/variations` | D/appearances/{id}/variations |
| GET | `/appearances/{id}/editor-model` | D/appearances/{id}/editor-model |
| GET | `/appearances/{id}/resolved-properties` | D/appearances/{id}/resolved-properties |
| GET | `/appearances/{id}/token-references` | D/appearances/{id}/token-references |
| POST | `/appearances/{id}/axes` | D/appearances/{id}/axes |
| DELETE | `/appearances/{id}/axes/{axisId}` | D/appearances/{id}/axes/{axisId} |
| POST | `/appearances/{id}/axis-order` | D/appearances/{id}/axis-order |
| POST | `/appearances/{id}/axes/{axisId}/values` | D/appearances/{id}/axes/{axisId}/values |
| DELETE | `/appearances/{id}/axis-values/{valueId}` | D/appearances/{id}/axis-values/{valueId} |
| PUT | `/appearances/{id}/axes/{axisId}/value-order` | D/appearances/{id}/axes/{axisId}/value-order |
| PUT, DELETE | `/appearances/{id}/property-values` | D/appearances/{id}/property-values |
| PUT | `/appearances/{id}/state-order` | D/appearances/{id}/state-order |
| POST | `/appearances/new` | D/appearances/new |
| POST | `/appearances/{id}/duplicate` | D/appearances/{id}/duplicate |
| GET, POST | `/appearance-variations` | D/appearance-variations |
| GET, PATCH, DELETE | `/appearance-variations/{id}` | D/appearance-variations/{id} |
| GET, POST | `/appearance-variation-values` | D/appearance-variation-values |
| GET, PATCH, DELETE | `/appearance-variation-values/{id}` | D/appearance-variation-values/{id} |
| GET, POST | `/styles` | D/styles |
| GET, PATCH, DELETE | `/styles/{id}` | D/styles/{id} |
| GET | `/styles/by-variation/{variationId}/by-design-system/{designSystemId}` | D/styles/by-variation/{variationId} |
| GET, POST | `/variation-property-values` | D/variation-property-values |
| GET, PATCH, DELETE | `/variation-property-values/{id}` | D/variation-property-values/{id} |
| GET | `/variation-property-values/by-style/{styleId}` | D/variation-property-values/by-style/{styleId} |
| GET | `/variation-property-values/by-appearance/{appearanceId}` | D/variation-property-values/by-appearance/{appearanceId} |
| GET, POST | `/invariant-property-values` | D/invariant-property-values |
| GET, PATCH, DELETE | `/invariant-property-values/{id}` | D/invariant-property-values/{id} |
| GET | `/invariant-property-values/by-component/{componentId}/by-design-system/{designSystemId}` | D/invariant-property-values/by-component/{componentId} |
| GET, POST | `/states` | G/states |
| GET, PATCH | `/states/{id}` | G/states/{id} |
| GET | `/states/{id}/impact` | G/states/{id}/impact |
| GET | `/state-sets` | G/state-sets |
| GET | `/state-sets/{id}` | G/state-sets/{id} |
| POST | `/state-sets/resolve` | G/state-sets/resolve |
| GET, POST | `/style-combinations` | D/style-combinations |
| GET, PATCH, DELETE | `/style-combinations/{id}` | D/style-combinations/{id} |
| GET, POST | `/style-combinations/{id}/members` | D/style-combinations/{id}/members |
| GET, POST | `/style-combination-members` | D/style-combination-members |
| GET, DELETE | `/style-combination-members/{id}` | D/style-combination-members/{id} |
| GET | `/component-config` | D/component-config |
| POST | `/component-config/import` | D/component-config/import |
| POST | `/component-config/export` | D/component-config/export |
| POST | `/component-config/web-adapter` | D/component-config/web-adapter |
| POST | `/design-systems/{id}/changes/revert` | D/changes/revert |
| POST | `/design-systems/{id}/changes/{changeId}/revert` | D/changes/{changeId}/revert |
| GET | `/design-systems/{id}/events` | D/events |
