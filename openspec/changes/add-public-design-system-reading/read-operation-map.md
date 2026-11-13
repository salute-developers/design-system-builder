# Карта операций чтения backend

## Основание и ограничения карты

Карта составлена по текущему checkout `feature/public-ds` до реализации. Источники: [OpenAPI](../../../backend-kt/ds-service/runtime/src/main/resources/openapi/documentation.yaml), [манифест](../../../backend-kt/ds-service/contracts/route-manifest.json), зарегистрированные Ktor-маршруты и прикладные сценарии. Адреса ниже приведены относительно `/api/design-systems`; публичный префикс — `/api/projects/{projectId}/design-systems`. Сопоставление статическое: оно определяет план реализации, а не доказывает безопасность ещё не написанного публичного режима.

В OpenAPI найден 91 маршрут чтения: GET и два POST (`export`, `web-adapter`). Все прочие методы по умолчанию закрыты. Чтение с названием «предварительная проверка» не становится публичным. Диагностика `/health`, `/ready`, OpenAPI и административные входы не относятся к данным ДС и сохраняют прежний контракт.

Статический поиск в `feature-*/application` обнаружил 54 файла с 58 вызовами `transactions.readOnly`; 18 из этих файлов содержат `ModelReadTarget`. Ещё 42 сценария компонентов используют `modelList` (17), `modelFind` (18), `modelFindList` (7). Эти группы пересекаются через помощники и включают закрытые операции; это не сумма будущих изменений и не число публичных маршрутов.

## Основные цепочки и необходимые изменения

| Группа | Существующая цепочка | Централизованное изменение | Локальные исключения |
|---|---|---|---|
| Карточка, списки токенов/компонентов/тем, стили | `DsAccessPolicy` → `readOnly(context, target)` → `ExposedModelReadSelectionResolver` | Единый подготовленный контекст чтения в `core`; разрешение публичности и последней публикации | Проверить DTO, счётчики и preview; в репозитории карточки они уже учитывают `ds.version_id`, `draftId` уже отсутствует у опубликованной строки |
| Токен, его значения, палитра темы, группы, оси, разрешённые свойства и ссылки | Тот же путь с `TOKEN/TENANT/APPEARANCE/DESIGN_SYSTEM` | Сохранить проверку ресурса относительно пути; не повторять выбор публикации после подготовки | Палитра может читать служебные редакции: наружу выдавать только редакции выбранной границы |
| Простые темы/значения, обычные компонентные чтения | `DsAccessPolicy` → `readOnly(context)` | Подготовить опубликованную границу либо режим живого draft перед блоком и выставить SQL-контекст | Типография и размеры читают `context.versionId` для `canEdit`; им нужен подготовленный контекст, не только SQL-настройка. `ListTenantPaletteLinksUseCase` должен сохранить `readContext` делегированного чтения |
| Списки/детали компонентной модели | `ComponentModelUseCaseSupport` → один из трёх помощников → `readOnly(context)` | Перевести помощники на общий подготовленный контекст; сохранить вызовы предметных сценариев | Общий помощник `policy.read` используется и записью: имя не является доказательством права на публичное чтение |
| Экспорт, web-адаптер, пакет компонента | Проверка права → `readOnly(context)` → несколько SQL-чтений | Разрешить одну версию в общем транзакционном входе; все внутренние чтения используют её | Контрактные тесты builders/ownership; не добавлять `if(public)` в каждый сборщик |
| Список публикаций | `readOnly(context, VERSION_HISTORY)` | Проверить публичность, но не ограничивать список единственным `versionId` | Пагинация/фильтр версии сохраняются; нет фиктивного «последнего» контекста у истории |
| Публикация по ID пути | `readOnly(context)` → publishedRows | Операция имеет отдельный вид: ID пути становится выбранной границей (параметр `id`, не query `versionId`) | Проверить совпадение с селекторами query; противоречие — 400, чужой/неизвестный ID — 404 |
| Глобальные определения | `readOnly(context)` и глобальные репозитории без системного фильтра | Только с явной публичной ДС и её публикацией; общий адаптер вычисляет используемые ID | Фильтр до пагинации. ExposedComponentTemplateRepository обходит ComponentOwnership: нужен отдельный фильтр шаблонов и dependsOn |
| Каталоги, журнал, SSE, предварительная проверка перестроения палитры, глобальное влияние состояния, плагины | Разные права и транзакции | Публичный вход отказывает по описателю операции | Предметные сценарии сохраняют проектное поведение |

### Где уже есть версия и где её нет

[SelectedVersionBoundary](../../../backend-kt/ds-service/core/src/main/kotlin/com/dsbuilder/ds/core/data/SelectedVersionBoundary.kt) использует локальный `ds.version_id`. Поэтому большинство версионированных репозиториев можно сохранить после подготовки одной границы. Общий `ComponentOwnership` ограничивает системные строки, однако его `readableDs` / `projectReadableDs` выбирают ДС всего проекта. Для публичного режима эти подзапросы и выбор используемых определений должны ограничиваться только выбранной ДС и публикацией; проектный и записывающий пути сохраняются. Это изменение общих предикатов в `feature-components/data`, а не публичные условия в каждом сценарии.

Но текущий `readOnly(context)` сам номер версии не разрешает и не добавляет `readContext` в результат. Его обновление должно покрыть оба эффекта, а не только разрешить гостя.

Текущий `ModelReadSelection.parse` объединяет отсутствие версии и явный `draft`; их необходимо разделить. `modelReadContext` вызывается не во всех маршрутах: например, token-values и component-config используют `TrustedDsRequestContextMapper` с одним `versionId`. Поэтому общий вход чтения разбирает селекторы для всех описанных операций до старых обработчиков и передаёт нормализованные метаданные через единый источник DS-контекста. Только изменение helper `modelReadContext` оставило бы часть маршрутов без поддержки точного номера версии. `configure` транзакционного адаптера должен явно устанавливать или очищать все значения контекста при каждом входе/повторе. `required`, `rollback` и неконтекстный `readOnly` не должны принимать публичный контекст; глобальные служебные операции не получают публичность автоматически.

### Общая авторизация

`ProjectPrincipal`, `TrustedProjectPrincipalFactory`, роли, области разрешений и `PolicyEvaluator` в `authorization-core` остаются прежними. Новый тип контекста доступа принадлежит `ds-service/core` и оборачивает проектный principal либо представляет кандидата на публичное чтение. В `DsAccessPolicy` делегирование общей RBAC выполняется только для настоящего проектного principal. Проверка публичного кандидата перед транзакцией лишь допускает разрешённую операцию и её разрешение; окончательный доступ возникает в транзакции.

В identity-gateway уже существуют `ProjectContextResolution.Allowed/Denied/Unavailable`. Их достаточно для решения о членстве: модель и БД `projects-service` не расширяются публичностью. Потребуется узкий прикладной сценарий шлюза, отличающий подтверждённого пользователя вне проекта от неверных credentials, недостаточных scopes PAT и недоступной проверки. Нельзя интерпретировать любой текущий `GatewayAuthDecision.Forbidden` как отсутствие членства: сейчас в `AuthorizeProjectRequestUseCase.authorizeActor` в него также превращается `Unavailable`.

## Полный перечень

Вид операции — планируемая семантика централизованной политики. «Граница ДС» означает публикацию в публичном режиме и существующий выбор версии в проектном; «связанные определения» требует явного контекста и фильтра используемых определений. «Закрыто» означает сохранение проектных ограничений независимо от публичности ДС.

Итого: закрыто: 8; граница ДС: 63; история: 1; публикация по ID: 1; связанные определения: 18.

| Метод | Остаток пути | Вид операции | Текущий вход чтения |
|---|---|---|---|
| GET | `/` | закрыто | ListDesignSystemsUseCase → readOnly(context) |
| GET | `/{designSystemId}` | граница ДС | GetDesignSystemUseCase → DESIGN_SYSTEM |
| GET | `/{designSystemId}/components` | граница ДС | feature-design-systems → DESIGN_SYSTEM |
| GET | `/{designSystemId}/token-groups` | граница ДС | ListTokenGroupsUseCase → DESIGN_SYSTEM |
| GET | `/{designSystemId}/tokens` | граница ДС | feature-design-systems → DESIGN_SYSTEM |
| GET | `/{designSystemId}/components/{componentId}/styles` | граница ДС | feature-design-systems → DESIGN_SYSTEM |
| GET | `/{designSystemId}/components/{componentId}/editor-bundle` | граница ДС | feature-components → readOnly(context); сборка нескольких чтений |
| GET | `/{designSystemId}/tenants` | граница ДС | ListTenantsUseCase → DESIGN_SYSTEM при наличии ID |
| GET | `/{designSystemId}/appearances` | граница ДС | ListDesignSystemAppearancesUseCase → readOnly(context) |
| GET | `/{designSystemId}/changes/summary` | закрыто | Журнал / SSE; отдельные сценарии |
| GET | `/{designSystemId}/changes/token-ids` | закрыто | Журнал / SSE; отдельные сценарии |
| GET | `/{designSystemId}/changes` | закрыто | Журнал / SSE; отдельные сценарии |
| GET | `/{designSystemId}/versions` | история | ListVersionsByDesignSystemUseCase → VERSION_HISTORY |
| GET | `/{designSystemId}/versions/{id}` | публикация по ID | GetDesignSystemVersionUseCase → readOnly(context) |
| GET | `/{designSystemId}/tenants/{id}` | граница ДС | feature-themes → readOnly(context) |
| GET | `/{designSystemId}/tenants/{id}/token-values` | граница ДС | feature-themes → readOnly(context) |
| GET | `/{designSystemId}/tenants/{tenantId}/palette` | граница ДС | GetTenantPaletteUseCase → TENANT |
| GET | `/{designSystemId}/tenants/{tenantId}/palette/links` | граница ДС | ListTenantPaletteLinksUseCase → GetTenantPaletteUseCase → TENANT; сейчас теряет readContext |
| GET | `/{designSystemId}/tenants/{tenantId}/typography-styles` | граница ДС | feature-themes → readOnly(context) |
| GET | `/{designSystemId}/tenants/{tenantId}/size-tokens` | граница ДС | feature-themes → readOnly(context) |
| GET | `/{designSystemId}/tokens/{id}` | граница ДС | GetTokenUseCase → TOKEN |
| GET | `/{designSystemId}/tokens/{id}/values` | граница ДС | GetTokenValuesUseCase → TOKEN |
| GET | `/{designSystemId}/token-values` | граница ДС | feature-tokens → readOnly(context) |
| GET | `/{designSystemId}/token-values/{id}` | граница ДС | feature-tokens → readOnly(context) |
| GET | `/catalog/palette` | связанные определения | feature-tokens → readOnly(context); глобальный репозиторий |
| GET | `/catalog/palette/{id}` | связанные определения | feature-tokens → readOnly(context); глобальный репозиторий |
| GET | `/catalog/palette/by-type/{type}` | связанные определения | feature-tokens → readOnly(context); глобальный репозиторий |
| GET | `/catalog/compose-preview/plugin` | закрыто | GetActivePluginBuildUseCase → readOnly без контекста |
| GET | `/catalog/web-preview/plugin` | закрыто | GetActivePluginBuildUseCase → readOnly без контекста |
| GET | `/catalog/components` | связанные определения | feature-components → readOnly(context); глобальная мета |
| GET | `/catalog/components/{id}` | связанные определения | feature-components → readOnly(context); глобальная мета |
| GET | `/{designSystemId}/components/{id}/variations` | граница ДС | ListComponentVariationsUseCase → readOnly(context) |
| GET | `/catalog/components/{id}/properties` | связанные определения | feature-components → readOnly(context); глобальная мета |
| GET | `/{designSystemId}/components/{id}/properties` | граница ДС | GetComponentPropertiesWithPlatformParamsUseCase → DESIGN_SYSTEM |
| GET | `/catalog/components/{id}/deps` | связанные определения | feature-components → readOnly(context); глобальная мета |
| GET | `/{designSystemId}/components/{id}/deps` | граница ДС | GetComponentDependenciesWithReuseConfigUseCase → DESIGN_SYSTEM |
| GET | `/{designSystemId}/design-system-components` | граница ДС | feature-components → readOnly(context) |
| GET | `/catalog/component-templates` | связанные определения | modelList → ExposedComponentTemplateRepository.list; прямое чтение всех web-компонентов, обход ComponentOwnership |
| GET | `/{designSystemId}/design-system-components/{id}` | граница ДС | feature-components → readOnly(context) |
| GET | `/catalog/component-deps` | связанные определения | feature-components → readOnly(context); глобальные зависимости |
| GET | `/catalog/component-deps/{id}` | связанные определения | feature-components → readOnly(context); глобальные зависимости |
| GET | `/{designSystemId}/component-reuse-configs` | граница ДС | feature-components → readOnly(context) |
| GET | `/{designSystemId}/component-reuse-configs/{id}` | граница ДС | feature-components → readOnly(context) |
| GET | `/{designSystemId}/component-reuse-configs/by-dep/{componentDepId}` | граница ДС | feature-components → readOnly(context) |
| GET | `/{designSystemId}/variations` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/variations/{id}` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/variations/{id}/styles` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/variations/{id}/properties` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/catalog/properties` | связанные определения | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/catalog/properties/{id}` | связанные определения | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/catalog/property-platform-params` | связанные определения | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/catalog/property-platform-params/{id}` | связанные определения | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/property-variations` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/property-variations/{id}` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/variation-platform-param-adjustments` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/variation-platform-param-adjustments/{id}` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/invariant-platform-param-adjustments` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/invariant-platform-param-adjustments/{id}` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/appearances/{id}` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/appearances/{id}/variations` | граница ДС | ListAppearanceVariationAxesUseCase → APPEARANCE |
| GET | `/{designSystemId}/appearances/{id}/editor-model` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/appearances/{id}/resolved-properties` | граница ДС | feature-components → APPEARANCE |
| GET | `/{designSystemId}/appearances/{id}/token-references` | граница ДС | feature-components → APPEARANCE |
| GET | `/{designSystemId}/appearance-variations` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/appearance-variations/{id}` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/appearance-variation-values` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/appearance-variation-values/{id}` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/styles` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/styles/{id}` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/styles/by-variation/{variationId}` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/variation-property-values` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/variation-property-values/{id}` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/variation-property-values/by-style/{styleId}` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/variation-property-values/by-appearance/{appearanceId}` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/invariant-property-values` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/invariant-property-values/{id}` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/invariant-property-values/by-component/{componentId}` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/catalog/states` | связанные определения | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/catalog/states/{id}` | связанные определения | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/catalog/states/{id}/impact` | закрыто | modelFind; глобальные последствия |
| GET | `/catalog/state-sets` | связанные определения | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/catalog/state-sets/{id}` | связанные определения | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/style-combinations` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/style-combinations/{id}` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/style-combinations/{id}/members` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/style-combination-members` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/style-combination-members/{id}` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/component-config` | граница ДС | GetComponentConfigUseCase → readOnly(context); специальная совместимость устаревшего version |
| POST | `/{designSystemId}/component-config/export` | граница ДС | feature-components → readOnly(context); сборка нескольких чтений |
| POST | `/{designSystemId}/component-config/web-adapter` | граница ДС | feature-components → readOnly(context); сборка нескольких чтений |
| GET | `/{designSystemId}/events` | закрыто | Журнал / SSE; отдельные сценарии |

## Проверка покрытия при реализации

OpenAPI является единственным источником перечня публичных операций через новое расширение `x-ds-public-read` со значениями `boundary`, `history`, `version-by-id`, `related-definitions`; отсутствие расширения означает отказ. При загрузке контракта должны проверяться допустимый HTTP-метод, ожидаемый шаблон пути, наличие явной системы и совместимость вида операции с параметрами. Шлюз и предметный вход получают один неизменяемый каталог через DI, без независимых списков URL.

Контрактный тест сравнивает зарегистрированные маршруты, OpenAPI, манифест и каталог политики. Для каждой разрешённой операции нужен положительный запрос на опубликованную границу и отрицательные проверки чужого ресурса/проекта, приватности и черновика. Для каждой закрытой операции — отказ публичному контексту. Такая проверка нужна и для GET с тем же permission, что у разрешённого чтения: `design-systems:read` одновременно встречается у карточки, журнала и SSE.

Отдельные тесты доказывают применение подготовленного контекста к обоим вариантам `readOnly`, вызовам трёх помощников, истории без выбранной единственной версии и SQL-фильтру связанных определений до пагинации. Прикладные вызовы без HTTP не должны иметь возможность создать доверенный описатель из произвольной строки; они получают его от прикладного каталога/внутреннего сценария и проходят ту же транзакционную проверку.

## Уточнения по результатам независимого ревью

- Версия закрепляется по первому разрешённому предметному ответу, а не обязательной карточке: экспорту достаточно `components:read`. Для черновика продолжается `version=draft`; `draftId` не является `versionId` и не фиксирует неизменный снимок.
- Для проектного GET component-config прежний `version` остаётся неисторической подсказкой и допускается вместе с `versionId`. Для публичного чтения действуют обычные селекторы публикации. Поле перестаёт быть обязательным, в том числе при передаче одного `versionId`; остальные параметры маршрута сохраняются.
- Уточнение фильтра `ComponentOwnership` не ограничит `ExposedComponentTemplateRepository.list`: его прямое чтение и вложенные `dependsOn` адаптируются отдельно и проверяются на компонентах других ДС и только черновых компонентах.
- Существующих результатов ProjectContextResolver достаточно для членства, но не для JWKS: JwtVerifier получает отдельную недоступность; ошибка получения нужного ключа без кеша даёт 503, а достоверно неверный токен — 401. Общая RBAC при этом остаётся прежней.
