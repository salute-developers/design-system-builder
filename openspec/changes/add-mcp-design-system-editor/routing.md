# Области маршрутов и перенос потребителей

## Источники инвентаризации

Текущий `backend-kt/ds-service/contracts/route-manifest.json` содержит 201 пару метода и суффикса в 37 группах. Это исходный перечень, а не окончательное число маршрутов переноса: действующие обработчики и OpenAPI содержат дополнительные операции, в том числе summary/revert журнала и events. До реализации сверяются manifest, `src/main/resources/openapi/documentation.yaml` и фактическое дерево маршрутов. Не реализованные устаревшие записи манифеста не восстанавливаются ради переноса.

Для каждой действующей операции фиксируется метод, старый/новый путь, область, способ определения владельца, DTO, правило авторизации и потребители. Проверка полноты должна подтверждать, что ни одна действующая операция не потеряна, кроме явно удаляемого старого адреса или объединяемого эквивалентного адреса. Источник контракта остаётся OpenAPI; этот документ задаёт правила переноса, а не второй независимый реестр.

Обозначения: `P = /api/projects/{projectId}`, `D = P/design-systems/{designSystemId}`, `C = P/ds` — сохранённый вход общего каталога. `/ds` отсутствует в пути конкретной системы, но не переименовывается у не затрагиваемого каталога.

## Семейства данных DS

| Текущая группа или путь | Целевой адрес относительно D | Уточнение |
|---|---|---|
| design-systems: чтение/изменение/удаление одной системы | корень D | ID системы находится в URL |
| design-systems: список/создание | P/design-systems | Область проекта, DS до создания отсутствует |
| design-systems: tokens | /tokens | Существующая проекция списка, её фильтры и пагинация |
| tokens: GET списка | /token-records | Сохраняется отдельный DTO TokenResponse[]; не сливается с проекцией |
| tokens: остальные методы | /tokens и /tokens/{tokenId} | Создание, чтение, изменение, удаление определения |
| token-values | /token-values и прежние подресурсы | Значение принадлежит DS через tokenId/tenantId |
| tenants: GET общего списка | /tenant-records | Сохраняет TenantResponse[] с preview и editRevision |
| tenants: остальные методы, tenant-palette, color-tokens, size-tokens, typography-styles | /tenants и прежние подресурсы | Все методы, включая существующее создание/удаление размеров, хотя новых MCP-tools для них нет |
| token-groups: список DS | /token-groups | Группы принадлежат DS, запись сохраняет tenantId в прежнем подресурсе |
| token-groups: мутации | /tenants/{tenantId}/token-groups… | Тема обязана принадлежать DS URL |
| design-systems: components/styles/tenants | /components…, /tenants | Сохраняются соответствующие DS-проекции |
| design-systems: appearances | /appearance-summaries | Сохраняется отдельный DTO сводок, отличный от /appearances |
| design-system-components | /design-system-components… | Связь общего компонента с DS |
| component-reuse-configs | /component-reuse-configs… | Подресурс by-dep сохраняется |
| variations, property-variations | /variations…, /property-variations… | После V14 принадлежат DS; прямые связи могут не иметь редакций |
| appearances, appearance-editor | /appearances… | Включая /new, duplicate, axes, axis-order, axis-values, value-order, property-values, state-order, editor-model, resolved-properties, token-references |
| appearance-variations, appearance-variation-values | /appearance-variations…, /appearance-variation-values… | Изменяется объявление выбранной конфигурации |
| styles, style-combinations, style-combination-members | прежние суффиксы | Все действующие методы в DS URL |
| invariant-property-values, variation-property-values | прежние суффиксы | Свойства, состояния и область варианта/сочетания |
| invariant-platform-param-adjustments, variation-platform-param-adjustments | прежние суффиксы | Это данные DS, а не глобальные определения параметров |
| component-config | /component-config… | Импорт, экспорт, web-adapter и прочие действующие методы |
| component-editor-bundle | /components/{componentId}/editor-bundle | Требуется связь общего компонента с DS |
| design-system-versions | /design-system-versions… | Все действующие методы; by-design-system не требует второго DS ID |
| design-system-changes | /design-system-changes… | Сохраняет свою форму DTO |
| design-systems: changes | /changes… | Лента/summary/token-ids/revert; не сливается с отличающимся DTO предыдущей строки |
| design-systems: events | /events | SSE и курсор относятся к одной DS |
| components/{componentId}/variations | /components/{componentId}/variations | Вариации принадлежат DS после V14 |

Для исходных путей, уже содержащих design-systems/{id}, этот сегмент не добавляется повторно. Повторный суффикс by-design-system/{designSystemId} удаляется: /styles/by-variation/{variationId}/by-design-system/{designSystemId} становится D/styles/by-variation/{variationId}, а /invariant-property-values/by-component/{componentId}/by-design-system/{designSystemId} — D/invariant-property-values/by-component/{componentId}. Одноимённые списки с одинаковыми контрактами объединяются в один канонический путь; различные DTO сохраняются отдельными путями, как /tokens и /token-records, /tenants и /tenant-records, /appearances и /appearance-summaries. Отличающиеся контрактами ответы нельзя выбирать неявно по наличию случайного фильтра. Существующая документированная семантика /appearances с componentId сохраняется.

## Общий каталог и прочие подсистемы

Группы palette (общий справочник, не tenant-palette), states, state-sets, properties, property-platform-params, component-deps, compose-preview и web-preview остаются вне D. Общие компоненты и их мета/свойства/каталоговые зависимости также сохраняют C/components… и административные ограничения. Для DS-проекции меты компонента используется D/components/{componentId} с проверкой его подключения; это не право менять общий компонент через DS URL. Вариации компонента и его стили относятся к D; поле ownership старого манифеста само по себе не определяет область.

Административный импорт API-меты и загрузки общих плагинов сохраняют /api/admin/…. Проекты, авторизация и самостоятельные документационные API не переименовываются. Серверные обращения к DS из других подсистем обновляются вместе с переносимым контрактом; внутренние URL не становятся альтернативным публичным входом.

## Потребители и инфраструктура

- `js/apps/client/src/api`: репозитории DS/тем/компонентов, editorReads, автосохранение, повторы, уведомления усечённых метаданных, SSE, ключи кэша. Ключи кэша содержат projectId и designSystemId; префиксные проверки старого /ds не должны отключить новую область.
- `frontend-kt`: feature-ds/theme/components/status, core-network и построители контекста; CLI и MCP используют общие адаптеры. Обнаружение систем проекта не требует выбранной DS. URI контекста MCP и публичные CLI-команды сохраняются.
- `frontend-kt/plugins`: Android Studio и другие имеющиеся потребители. Списки токенов/значений проекта без DS заменяются выбранной DS из уже существующего выбора системы; сигнатуры адаптеров и их тесты обновляются. Нельзя угадывать первую доступную DS.
- Серверные потребители: проверка владельца DS в documentation-service, оставшиеся HTTP-вызовы DS и внутрипроцессные адаптеры монолита; проверяются также project-publisher, скрипты и js/cli. Обновляются только фактические потребители найденных маршрутов.
- Вход монолита: GatewayRequestHandler, DsBodyCache, регистрация и классификация публичных маршрутов, проверки их границ. Новая ветка /design-systems не должна попасть в обработчик Projects вместо DS.
- Самостоятельный вход DS и поддерживаемые gateway-конфигурации: новая область проходит авторизацию проекта, DS берётся из path, внутренние служебные заголовки не принимаются как доказательство прав.
- OpenAPI/API Reference: общая декларативная классификация project/DS/catalog/admin используется для публикации путей и обязательных path-параметров. Одного правила замены /api/ds на фиксированный префикс больше недостаточно; ручное дублирование списка операций в Scalar или nginx не допускается.

## Удаление прежних путей

Старые публичные маршруты данных DS под P/ds удаляются для всех методов, включая GET; скрытый путь без обязательной DS не сохраняется. Для оставленного общего каталога C это удаление не применяется. Внутренний контракт самостоятельного DS также требует явную область там, где операция работает с конкретной DS; тестовый/служебный вход не может отключить ограничение публичного запроса.
