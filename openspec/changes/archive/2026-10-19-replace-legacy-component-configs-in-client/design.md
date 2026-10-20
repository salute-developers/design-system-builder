## Контекст

`ThemeEditorRepository` грузит компоненты через `componentRepository.loadComponentData(context, signal, platform)`:

- `design-system-components`, `components`, `appearances` и `component-config/export` (черновик или граница `versionId`);
- по каждому компоненту `components/{id}/properties`, `components/{id}/variations` и `variations/{id}/styles`.

Все чтения идут через `readEditor`: он объединяет одинаковые запросы, ограничивает частоту и передаёт `versionId`. Свойства попадают в `sources.api` с `platformMappings.web: null` и `variations: null`.

Как модель используется дальше:

- `Prop` берёт имена CSS-переменных из `platformMappings.web` (`prop.ts`, `typography.ts`).
- Панель свойств фильтрует их по `api[].variations`.
- Палитра отмечает web-свойства через `getWebTokens()`.

Legacy-ручка db-service отдавала это готовым.

## Цели / Вне целей

**Цели:**
- web-превью получает переменные темы;
- панели вариаций показывают свои свойства;
- клиент не содержит кода legacy-ручек;
- версионная модель, автосохранение и серверные привязки `componentRepository` не меняются.

**Вне целей:**
- Compose-превью: имена берутся из меты плагина.
- Зависимости компонентов.
- Удаление db-service.
- Публикация версий: её делает пользователь из журнала.

## Решения

- **Дополнение, а не замена загрузчика.** Для `platform === 'web'` в тот же `Promise.all` добавляются три чтения через `readEditor`: `property-platform-params`, `property-variations` и `component-config/web-adapter` (`{designSystemId}`). Для Compose они не выполняются. Глобальные списки фильтруются по свойствам компонента. Идентификаторы свойств, привязки и ревизии остаются из `componentRepository`.
- **Чистые функции сборки** в `api/componentModelEnrichment.ts`:
  - `webParamsByProperty` — web-имена в порядке базы, как их завёл импорт API-меты;
  - `variationNamesByProperty` — по вариациям компонента;
  - `templateLookup` — первый шаблон по стилям компонента: внутри компонента шаблоны appearance совпадают;
  - `enrichApi` — свойство без web-параметра остаётся с `web: null`.
- **Мёртвый код удаляется, а не переводится на ds-service.** Создание дизайн-системы идёт через `POST /design-systems`, сохранение темы — через `PUT /tenants/{id}/token-values` и операции токенов.
- **Импорт дизайн-системы из файла переводится на ds-service.** `importDesignSystemToProject` делает:
  - `POST /design-systems`;
  - `POST /tenants` для `<имя>_default`;
  - `POST /tokens` для определений файла, которых нет в дизайн-системе;
  - `PUT /tenants/{id}/token-values` одним пакетом;
  - выключение определений, которых нет в файле (`PATCH /tokens/{id}`, `enabled: false`), очередью с учётом лимита gateway.

  Версию импорт не публикует, дизайн-система остаётся черновиком. Ошибка после создания откатывается удалением дизайн-системы.

## Риски / Компромиссы

- [Глобальные списки параметров и связей большие] → один запрос на каждый, `readEditor` объединяет их между компонентами. При росте модели их заменит фильтр по `componentId`, если он появится в ds-service.
- [Шаблоны берутся из `web-adapter`, а их хранение в ds-service отменено] → для `base` шаблоны в базе есть. Для компонентов, заведённых через `components push`, шаблон лежит в манифесте генератора, и превью покажет первое число.
