## Why

Импорт конфигураций (`POST /api/design-systems/{id}/component-config/import`, `dsbuilder components push`) не создаёт
часть ссылок `component_style`. Пакет `sdds_serv` (платформа `compose`, 144 конфигурации) при полной загрузке на dev
сообщает `Component style references not matched: 23`: ссылки `ai-input-icon-button-group.l.no-gap.default`,
`dropdown-empty-state.l.has-button`, `notification-content.button-stretch.default`,
`tab-bar-item-clear.l.label.accent` и ещё 19 остаются без записи в `component_style_references`. Сами оформления
и значения загружены, не хватает только связей родителей (`ai-input-*`, `dropdown-menu-*`, `notification-*`,
`tab-bar-*`) со стилями вложенных компонентов.

Причина: хвост ссылки пишется идентификаторами вариаций пакета (`no-gap`, `button-stretch`, `label`), а импортёр ищет
каждый сегмент среди имён значений осей, то есть значений биндингов (`gap = none`, `button-layout = stretch`,
`label-placement = bottom`). Для компонентов, у которых идентификатор вариации не равен значению биндинга, ссылка
не находит цель. Оптимизация импорта (`optimize-component-config-import`) здесь ни при чём: эталон результата снят на
исходном коде и показывает то же самое.

## What Changes

- Разрешение ссылки `component_style` при импорте: хвост ссылки раскладывается на группы последовательных сегментов;
  группа равна либо имени значения оси цели (как сейчас), либо исходному идентификатору значения или сочетания
  (`authored_id`) в целевом оформлении. Ссылка разрешена, если группы покрывают весь хвост.
- Правила, которые действуют сейчас, сохраняются: ссылка, разрешённая по именам значений, разрешается так же и
  результат не меняется. Новый способ срабатывает только там, где раньше ссылка оставалась неразрешённой.
- Текст ссылки (`reference`) хранится как в пакете, ничего не переписывается.
- Отчёт: ссылки, которые теперь разрешаются, перестают попадать в `unresolvedComponentStyles`; формат ответа и
  коды отказов не меняются.

Не входит: переписывание ссылок в конвертере (`theme-converter`), вывод идентификаторов вариаций
(`underivableVariationIds` остаётся информационным списком), изменение схемы БД и миграции, CLI.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `component-nested-style-references`: новое требование о разрешении сегментов ссылки по исходным идентификаторам
  значений и сочетаний целевого оформления.

## Impact

- `backend-kt/ds-service/feature-components`: `ComponentConfigImporter.resolveReferences`, `ReferenceTarget` и
  `ComponentConfigImportContext` (индекс исходных идентификаторов цели читается один раз на цель).
- Тесты `ds-service`: интеграционный сценарий импорта и эталон эквивалентности.
- Данные dev: после выката повторный `components push` для `sdds_serv` создаёт недостающие ссылки; другие данные не
  затрагиваются.
- API, схема БД, CLI и `documentation.yaml` не меняются.
