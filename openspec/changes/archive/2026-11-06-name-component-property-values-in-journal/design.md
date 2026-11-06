## Context

Записи `variation-property-value` и `invariant-property-value` приходят с полями ревизии значения: `token_id`, `value`, `alpha`, `adjustment`, `position`. Кроме них сервер добавляет `property_id`, `appearance_id`, `state_set_id`, у вариационного значения — `style_id`, у инвариантного — `component_id`.

`presentChangedFields` строит поля по изменённым путям. Подпись поля задаёт `fieldLabel`: для пути `value` это «Значение», а `token_id` отображается как значение через `namesById`.

`loadJournalComponentMetadata` читает `/components`, `/design-systems/{id}/appearances`, `/properties`, `/variations`, `/styles` и возвращает `componentNames` и `referenceNames` (id → имя).

## Goals / Non-Goals

**Goals:**
- По записи журнала понятно, какое свойство, где и для какого состояния изменилось.

**Non-Goals:**
- Изменение заголовка записи, группировки, отмены и навигации.
- Серверное обогащение записей именами.

## Decisions

### Подпись строится на клиенте из уже загружаемых метаданных

`JournalComponentMetadata` получает два новых поля:

```ts
interface JournalComponentMetadata {
    componentNames: Record<string, string>;
    referenceNames: Record<string, string>;
    /** Стиль → имя его вариации. */
    styleVariations: Record<string, string>;
    /** Набор состояний → имена состояний; у базового набора список пуст. */
    stateSetStates: Record<string, string[]>;
}
```

Метаданные дополнительно читают `/states` и `/state-sets` параллельно с прежними запросами. Это два небольших справочника, они уже читаются редактором компонента.

`presentJournal` для записей значений свойств вычисляет подпись места:

```ts
function propertyValueLabel(change: DraftChangeDto, metadata: JournalComponentMetadata): string | undefined;
// «Accordion item gap · size: m», «Disable alpha · Инвариант», «Background · view: default · pressed + hovered»
```

Эта подпись заменяет «Значение» у полей `value`, `token_id`, `alpha`, `adjustment`. Остальные поля (например, `position`) подписываются как раньше.

Имя свойства приводится к виду инспектора: `humanizeName` переносится из модели инспектора в общий модуль. Порядок состояний — как в инспекторе: `focused`, `pressed`, `hovered`.

Альтернатива — добавить имена в записи журнала на сервере. Отклонена: контракт журнала и так несёт идентификаторы, имена клиент уже читает, а серверное обогащение затронуло бы чтение журнала для всех типов сущностей.

## Risks / Trade-offs

- **[Удалённое свойство или стиль]** Имени может не быть в метаданных. → Подпись собирается из известных частей; если неизвестно ничего, остаётся «Значение». Идентификаторы не показываются, как требует спецификация журнала.
