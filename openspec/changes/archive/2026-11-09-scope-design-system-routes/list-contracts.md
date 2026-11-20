# Единые контракты списков токенов и тем

## Результат исследования клиентов

Проверено статически на `7d948d60`. Потребление поля означает либо прямое использование после HTTP-загрузки, либо обязательное декодирование транспортного DTO. Тестовые фикстуры и объявления TypeScript сами по себе не считаются доказательством использования. Пути ниже относительно корня репозитория.

### Токены

| Поля списка | Потребители и назначение |
|---|---|
| `id`, `name` | `js/apps/client/src/api/tokenRepository.ts`: соединение определений со значениями, адреса мутаций, карты по имени; `componentRepository.ts`: разрешение tokenId по имени; журнал и адресное чтение токена |
| `type` | `tokenRepository.ts`: выбор семейства, режимов и декодирования значения; `pages/colors/useColorTokenEditor.ts`: выбор цветовых определений; Kotlin CLI и Android Studio plugin |
| `displayName`, `description`, `enabled` | `tokenRepository.ts`: метаданные редактируемой темы; `frontend-kt/feature-theme/.../data/HttpRemoteThemeDataSource.kt`: преобразование в Token и метаданные локального пакета |
| `groupId`, `position` | `js/apps/client/src/pages/colors/colorTokenEditor.ts:definitionsByName`, `modules/colorTokens/data/httpTokenGroupRepository.ts:definitions`: размещение токенов в группах и порядок |
| `publishedIn` | Те же адаптеры → `ColorTokenInspector.tsx`, `ColorTokenTree.tsx`: предупреждения об изменении опубликованного токена |
| `designSystemId` | Kotlin CLI декодирует/сохраняет идентификатор; `frontend-kt/plugins/android-studio/.../tokens/UseCases.kt` пока фильтрует проектный список по выбранной системе. После переноса фильтр становится избыточным, поле сохраняется |
| `createdAt`, `updatedAt` | `HttpRemoteThemeDataSource.TokenResponse`: обязательные декодируемые строки, переходящие в доменную модель и локальные метаданные. Веб-список их не использует, но удаление сломает загрузку Kotlin-клиента |

Android Studio plugin декодирует `id`, `designSystemId`, `name`, `type`, `displayName`; остальные поля не нужны его модели. MCP использует общий `feature-ds/.../ModelReadResponseDecoder.compactItems`: для `tokens_list` оставляет только `id`, `name`, `type`, `displayName`, `description`. Это представление MCP, а не отдельный HTTP-контракт; менять его не требуется.

### Темы

| Поля списка | Потребители и назначение |
|---|---|
| `id`, `name`, `designSystemId` | `pages/themes/ThemeCard.tsx`: заголовок и навигация; `ThemeSettingsPage.tsx`: выбор и переименование; обзор/настройки системы, `exportDesignSystemFile.ts`: выбор темы по имени и ID |
| `description` | `HttpDesignSystemTenantsClient.TenantDto`: публичная модель выбора темы, в том числе для IDE; `HttpRemoteThemeDataSource.TenantResponse`: декодирование/перенос в доменную модель. Не удалять из-за отсутствия вывода на карточке |
| `colorConfig.profile` | `ThemeCard.tsx`, `ThemeSettingsPage.tsx`: подпись профиля; полный `colorConfig` сохраняется в DTO, чтобы не вводить новую форму объекта и не терять прежние параметры |
| `preview.accentLight`, `onAccentLight`, `surfaceLight`, `accentDark`, `surfaceDark` | `ThemeCard.tsx`: цвета двух панелей карточки. Есть резервное значение при отсутствии preview, но это не основание убирать серверную проекцию; `theme-lifecycle` уже требует её актуальности |
| `createdAt`, `updatedAt` | `HttpRemoteThemeDataSource.TenantResponse`: обязательны при декодировании CLI-загрузки; сохранить, даже если карточки дат не показывают |
| `editRevision` | Прямого использования именно из списка тем не найдено. `tokenRepository.loadTokenData` читает редакцию из отдельного `GET /tenants/{tenantId}` и редакций значений. Общее объявление `ThemeTenant` ещё не означает использования списка для конкурентной записи |

`HttpDesignSystemTenantsClient` использует только `id`, `name`, `description` и игнорирует неизвестные поля. Kotlin CLI-загрузка использует `id`, `designSystemId`, `name`, `description`, даты. MCP для `tenants_list` передаёт элементы без отдельного сокращения полей. HTTP-контракт от этого не меняется.

Найдена существующая несогласованность: `DesignSystemTenantSummaryResponse` формирует только `grayTone`, `accentColor`, `light`, `dark` внутри `colorConfig`, не отдаёт `profile`, `customPalette`, `preview`, `editRevision`. При этом `themesApi.list` типизирован полным `ThemeTenant[]`, а карточки и настройки читают профиль и preview. TypeScript не проверяет реальный JSON; наличие резервной палитры маскирует отсутствие серверного поля. Выбор полного TenantResponse устраняет расхождение без дополнительного запроса каждой темы.

## Решение с минимальными изменениями

Исследование ниже относится к DTO ответов. `designSystemId` в элементах списков сохраняется; его дублирование во входных DTO/query системных операций удаляется, поскольку система уже задана путём.

Выбираются два существующих DTO, каждый для своего списка. Универсальная модель для списков, деталей и мутаций не вводится. Не меняются nullability, значения по умолчанию и семантика полей существующих DTO. Формат ответа — массив; текущие фильтры, граница версии и необязательная пагинация сохраняются.

### `GET /api/projects/{projectId}/design-systems/{designSystemId}/tokens`

Канонический элемент — существующий `DesignSystemTokenSummaryResponse` из `feature-design-systems`, без изменения набора полей:

| Поле | Тип |
|---|---|
| `id`, `name`, `createdAt`, `updatedAt` | `string` |
| `designSystemId`, `type`, `displayName`, `description` | `string` или `null`, как в текущем DTO |
| `enabled` | `boolean` или `null`, как в текущем DTO |
| `groupId`, `publishedIn` | `string` или `null` |
| `position` | `number`, целое |

Все поля обычного `TokenResponse` уже присутствуют в этом DTO. Поэтому сводный список не нужно расширять, а обычный проектный обработчик списка можно удалить после переноса потребителей. Детали и результаты мутаций сохраняют прежний `TokenResponse`; добавлять туда поля размещения ради единообразия не требуется. Принадлежность системе пути проверяется независимо от сохранённой nullable-формы `designSystemId` DTO.

### `GET /api/projects/{projectId}/design-systems/{designSystemId}/tenants`

Канонический элемент — существующий `TenantResponse` из `feature-themes`:

| Поле | Тип |
|---|---|
| `id`, `designSystemId`, `createdAt`, `updatedAt` | `string` |
| `name`, `description` | `string` или `null` |
| `colorConfig` | Существующий `ColorConfigurationDto`: `profile`, `customPalette`, `grayTone`, `accentColor`, `light`, `dark` с нынешними nullable/необязательными полями |
| `editRevision` | `number`, целое |
| `preview` | Существующий объект из пяти CSS-цветов: `accentLight`, `onAccentLight`, `surfaceLight`, `accentDark`, `surfaceDark` |

`editRevision` остаётся для повторного использования готового DTO и его сценария, а не потому, что список должен управлять конкурентной записью. Клиенты по-прежнему получают актуальные редакции из предметного чтения перед сохранением. Не вводить отдельный сокращённый тип и не удалять даты ради экономии нескольких полей.

Единственный обработчик списка тем размещается в `feature-themes`, использует существующие `TenantResponse`, репозиторий и построение preview. Ожидаемая система ограничивает выборку до расчёта редакций и preview; существующие серверные фильтры/пагинация применяются до обогащения выбранных элементов. Старый агрегирующий обработчик `feature-design-systems` снимается с регистрации. Зависимость между фичами ради импорта DTO или вызова другого use case не добавляется; не создавать копию полного TenantResponse в `feature-design-systems`.

Существующее `ExposedTenantRepository.listAccessible` уже умеет `tenantEditRevisions` и `withResolvedPreviews`; при реализации нужно сохранить эту семантику в ограниченной/постраничной выборке. Не заменять её дополнительными HTTP-запросами или загрузкой деталей по одной теме, не расширять .sdds или MCP-инструменты.

## Изменения клиентов и проверки

- Веб-клиент: заменить URL; `TokenDefinitionDto` и `ThemeTenant` уже читают выбранную форму, новый адаптер объединения не требуется.
- Kotlin CLI: заменить URL, сохранить декодируемые поля и игнорирование дополнительных полей; проверить неизменность локальных метаданных.
- Android Studio plugin: передать систему в запрос списка токенов вместо загрузки всех проектных токенов; декодер полей сохраняется. Выбор тем продолжает использовать компактную клиентскую модель.
- MCP: заменить URL общего адаптера; существующее сокращение `tokens_list` сохраняется, `tenants_list` получает полный серверный элемент без дополнительного механизма вариантов.
- Контрактные проверки: сводные поля и даты токенов; `profile`, полный `colorConfig`, пять реальных preview-цветов, даты и редакция темы; страница/фильтр до обогащения; отсутствие дополнительных клиентских запросов; список B не попадает в A. Отдельно проверить, что конкурентная запись не начинает использовать редакцию из кэшированного списка.
