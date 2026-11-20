# Карта операций чтения backend

## Исходный снимок и согласованные дополнения

Исходные 91 пара метод/путь взяты из [OpenAPI](../../../backend-kt/ds-service/runtime/src/main/resources/openapi/documentation.yaml) checkout `69d54e3c`; [манифест](../../../backend-kt/ds-service/contracts/route-manifest.json) и прикладные вызовы сверены статически. Это снимок исследования, а не обещание неизменности актуального dev. В приложение отдельно включены GET иконок из `origin/dev` (`1130166a`) и пять планируемых системных чтений. При реализации карта и контракт сверяются с фактической базой; код в этом Change не меняется.

Адреса таблиц приведены после `/api/design-systems`; публичный префикс — `/api/projects/{projectId}/design-systems`. «Граница ДС» — общий транзакционный доступ к выбранной системе и публикации либо живому черновику участника. «Закрыто» сохраняет проектную авторизацию. «Общий ресурс» — только явно согласованные preview/иконки, без нового типа `environment` и без выбора ДС.

## Общие точки подготовки чтения

Статический поиск исходной базы: 54 прикладных файла содержат 58 вызовов readOnly; 18 файлов используют ModelReadTarget. 42 компонентных сценария вызывают три общих помощника modelList/modelFind/modelFindList. Эти пересекающиеся числа не являются оценкой количества правок.

| Группа | Централизованная точка | Исключение/проверка |
|---|---|---|
| Карточка, темы, токены, конфигурации | Оба контекстных readOnly → DsReadScopeResolver | Публичность/проект раньше запрета draft; выбор публикации в той же транзакции |
| Чтение с ModelReadTarget | Та же подготовка + проверка принадлежности ресурса пути | Не выбирать последнюю публикацию повторно |
| Простые компонентные чтения | Три помощника ComponentModelUseCaseSupport | policy.read используется также записью, поэтому не заменяет описание операции |
| Размеры/типографика/палитра | Подготовленный контекст и ds.version_id | canEdit=false у публикации; ListTenantPaletteLinksUseCase сохраняет readContext |
| Экспорт/web-адаптер/editor-bundle | Одна граница через существующие сборщики | Первая разрешённая операция возвращает версию без обязательной карточки и лишнего scope PAT |
| История и деталь версии | history либо version-by-id | Истории не приписывать одну версию; ID пути детали не подменяется query |
| Необходимые определения | Системные properties/deps/editor-bundle и пять дополнений ниже | SQL-отбор только по выбранной границе; общий catalog закрыт, в том числе шаблоны/dependsOn |
| Preview и иконки | Явный перечень трёх GET в общем входе и обработчиках | Без членства и ДС, сохранить кеш/ETag/304; загрузка и публикация защищены |

SelectedVersionBoundary уже использует ds.version_id; большинство репозиториев сохраняются. Отсутствие селектора и явный draft разделяются общим парсером. Проектный GET component-config сохраняет устаревший version как неисторическую подсказку; в публичном режиме version является обычным селектором. Простой readOnly добавляет фактические метаданные, которые нельзя терять в делегирующих сценариях. Черновик продолжается через draft, не versionId=draftId.

Общий ComponentOwnership применяется только к системным связям и новым адресным проекциям. ExposedComponentTemplateRepository.list читает весь набор web-компонентов, но адаптировать его для гостя больше не требуется: каталог шаблонов полностью закрыт. Параметр query designSystemId не открывает ни один общий каталог и не заменяет ID из pathParameters.

ProjectPrincipal, роли/scopes и PolicyEvaluator в authorization-core остаются прежними; DsAccessPolicy получает DS-контекст. Для членства достаточно ProjectContextResolution.Allowed/Denied/Unavailable. JwtVerifier отдельно различает недоступность JWKS и неверный токен внутри identity-gateway. Записывающие транзакции не принимают публичный контекст.

## Исходные операции

Исходный снимок: закрыто: 24, граница ДС: 63, история: 1, публикация по ID: 1, общий ресурс: 2.

| Метод | Остаток пути | Доступ | Текущая точка чтения |
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
| GET | `/catalog/palette` | закрыто | feature-tokens → readOnly(context); глобальный репозиторий |
| GET | `/catalog/palette/{id}` | закрыто | feature-tokens → readOnly(context); глобальный репозиторий |
| GET | `/catalog/palette/by-type/{type}` | закрыто | feature-tokens → readOnly(context); глобальный репозиторий |
| GET | `/catalog/compose-preview/plugin` | общий ресурс | GetActivePluginBuildUseCase; открыть чтение, сохранить прежнее кеширование |
| GET | `/catalog/web-preview/plugin` | общий ресурс | GetActivePluginBuildUseCase; открыть чтение, сохранить прежнее кеширование |
| GET | `/catalog/components` | закрыто | feature-components → readOnly(context); глобальная мета |
| GET | `/catalog/components/{id}` | закрыто | feature-components → readOnly(context); глобальная мета |
| GET | `/{designSystemId}/components/{id}/variations` | граница ДС | ListComponentVariationsUseCase → readOnly(context) |
| GET | `/catalog/components/{id}/properties` | закрыто | feature-components → readOnly(context); глобальная мета |
| GET | `/{designSystemId}/components/{id}/properties` | граница ДС | GetComponentPropertiesWithPlatformParamsUseCase → DESIGN_SYSTEM |
| GET | `/catalog/components/{id}/deps` | закрыто | feature-components → readOnly(context); глобальная мета |
| GET | `/{designSystemId}/components/{id}/deps` | граница ДС | GetComponentDependenciesWithReuseConfigUseCase → DESIGN_SYSTEM |
| GET | `/{designSystemId}/design-system-components` | граница ДС | feature-components → readOnly(context) |
| GET | `/catalog/component-templates` | закрыто | modelList → ExposedComponentTemplateRepository.list; проектный каталог целиком закрыт гостю |
| GET | `/{designSystemId}/design-system-components/{id}` | граница ДС | feature-components → readOnly(context) |
| GET | `/catalog/component-deps` | закрыто | feature-components → readOnly(context); глобальные зависимости |
| GET | `/catalog/component-deps/{id}` | закрыто | feature-components → readOnly(context); глобальные зависимости |
| GET | `/{designSystemId}/component-reuse-configs` | граница ДС | feature-components → readOnly(context) |
| GET | `/{designSystemId}/component-reuse-configs/{id}` | граница ДС | feature-components → readOnly(context) |
| GET | `/{designSystemId}/component-reuse-configs/by-dep/{componentDepId}` | граница ДС | feature-components → readOnly(context) |
| GET | `/{designSystemId}/variations` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/variations/{id}` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/variations/{id}/styles` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/variations/{id}/properties` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/catalog/properties` | закрыто | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/catalog/properties/{id}` | закрыто | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/catalog/property-platform-params` | закрыто | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/catalog/property-platform-params/{id}` | закрыто | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
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
| GET | `/catalog/states` | закрыто | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/catalog/states/{id}` | закрыто | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/catalog/states/{id}/impact` | закрыто | modelFind; глобальные последствия |
| GET | `/catalog/state-sets` | закрыто | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/catalog/state-sets/{id}` | закрыто | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/style-combinations` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/style-combinations/{id}` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/style-combinations/{id}/members` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/style-combination-members` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/style-combination-members/{id}` | граница ДС | ComponentModelUseCaseSupport → modelList/modelFind/modelFindList |
| GET | `/{designSystemId}/component-config` | граница ДС | GetComponentConfigUseCase → readOnly(context); специальная совместимость устаревшего version |
| POST | `/{designSystemId}/component-config/export` | граница ДС | feature-components → readOnly(context); сборка нескольких чтений |
| POST | `/{designSystemId}/component-config/web-adapter` | граница ДС | feature-components → readOnly(context); сборка нескольких чтений |
| GET | `/{designSystemId}/events` | закрыто | Журнал / SSE; отдельные сценарии |

## Дополнение к исходному снимку

| Метод | Остаток пути | Источник | Доступ/контракт |
|---|---|---|---|
| GET | `/catalog/icons` | Добавлен в dev после исходного снимка | Без входа; прежний DTO каталога иконок, ETag/If-None-Match/304 |
| GET | `/{designSystemId}/components/{componentId}` | Из #167 | ComponentResponse только связанного компонента, метаданные границы |
| GET | `/{designSystemId}/component-deps` | Из #167 | Массив зависимостей только компонентов выбранной границы |
| GET | `/{designSystemId}/states` | Из #167 | Используемые состояния в прежнем формате массива |
| GET | `/{designSystemId}/state-sets` | Новая системная проекция | Используемые наборы без недоступных вложенных ID |
| GET | `/{designSystemId}/palette` | Новая системная проекция | Необходимые PaletteItem[] для CLI/просмотра |

Системный список компонентов дополнительно отдаёт platform; остальные прежние поля сохраняются. Системные properties/deps/editor-bundle переиспользуются для свойств и параметров. Catalog/property-platform-params, states, component-deps, palette и другие общие каталоги не становятся публичными даже при query с ID публичной ДС.

## Проверка покрытия

OpenAPI описывает boundary/history/version-by-id для содержимого ДС. Preview/иконки входят в один явный перечень исключений шлюза/предметного входа без нового вида environment и без no-store. Контрактные проверки сравнивают регистрацию, YAML, манифест, исходную карту и дополнения на фактической базе реализации. Неизвестные операции и все прочие методы закрыты по умолчанию.

Для каждого системного чтения проверяются публикация, отсутствие данных соседней ДС/черновика, приватность и неподменяемость пути query. Обязательны приватная+draft→404 и публичная+draft→403. Для catalog — отказ, кроме трёх исключений; для icons — 200/304, для preview — прежний контракт отсутствующего ресурса. Клиентские проверки подтверждают нейтральное предложение входа при анонимном 404, отсутствие закрытых catalog-запросов и успешный гостевой просмотр preview/иконок. Изменения лимитера, аудит доступности и новые события не входят в проверки Change.

## Интеграция маршрутов #167

Исходная таблица остаётся снимком прежней базы. До реализации она сверяется с интегрированным `version-core-entities-and-preview`: системные detail/component-deps/states, properties и property-platform-params переиспользуются и классифицируются как boundary; системное разрешение preview по ДС/версии/платформе также получает boundary. Точный шаблон и operationId берутся из OpenAPI #167, без создания второго маршрута. Для states сохраняются различия глобальных interaction states и компонентных состояний Core из #167; публичная проекция не раскрывает несвязанные данные.

Compatibility-диагностика, управление выбором Core и ремонт не получают публичного разрешения по факту появления в #167. Общие catalog остаются закрытыми независимо от query. Все релизные метаданные используют Core выбранной границы; preview использует закреплённую сборку без fallback на общий дескриптор. Для системного публичного дескриптора действует no-store; для общих ресурсов сохраняется кеширование.
