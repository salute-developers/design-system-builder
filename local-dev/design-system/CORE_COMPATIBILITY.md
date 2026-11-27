# Пакет сида для Compose Core

Пакет `components/` согласован с `uikit-compose/compose`
`0.57.0-dev.98c5181ab1436859ae2c27045a38c01b396293cc` из Android PR #978.
SHA-256 исходной API-меты: `d7c5aa6b49582294022346815e5a4a149fb4d565268a71d8aee392c6b25dfea4`.
Это версия Core; версия самой дизайн-системы из meta.json имеет самостоятельный смысл.

## Изменения

- Компонент `bottom-sheet` переименован в `modal-bottom-sheet`, как в API Core;
  имя оформления `modal-bottom-sheet` и все его параметры сохранены.
- `Switch.toggleThumbPadding` → `togglePadding`: имя `@ApiName` метода UIKit.
- `SegmentItem`, `TextField`, `TextArea`: `disableAlpha` → `disabledAlpha`.
- `TabItem.startContentPadding` → `iconPadding` — отступ стартовой иконки.

## Непредставимые старые параметры

Полный список исходных значений и путей сохранён в `legacy-core-overrides.json`.
Эти значения исключены из активных конфигураций, поскольку текущий Core не предоставляет
соответствующих параметров. Это не обещание визуальной эквивалентности старому пакету.

- `Avatar.extraOffsetX/Y` относятся к отдельному extra-слоту и не являются
  синонимами `statusOffsetX/Y`. Существующие status-смещения сохранены без изменений.
- `Counter.paddingTop/Bottom`: Core поддерживает minHeight и горизонтальные отступы;
  вертикальное положение содержимого определяется его layout. minHeight сохранён.
- `Overlay.blurRadius`: Core Overlay предоставляет только backgroundColor.
  Blur не переносится произвольно в другой компонент.
- `ProgressBar.disableAlpha`, `ListItem.disableAlpha`: соответствующих параметров
  нет в API Core. Альфа других элементов не изменяется вместо них.
- `TextField/TextArea.prefixPadding/suffixPadding`: legacy-значение 6dp нельзя задать
  стилем; PrefixSuffixWrapper текущего UIKit использует фиксированные 4dp.
- `List.scrollBarStyle`: scrollbar управляется родительским DropdownMenu.
  В обоих родительских оформлениях уже задана та же ссылка `scroll-bar.s`.
- `FormItem.captionSpacing` не объединяется с captionPadding: оба поля присутствовали
  одновременно и имели разный смысл. Поддерживаемый captionPadding сохранён.

После `refresh-local-dev-assets.sh` пакет необходимо снова сверить с API того Core,
который будет выбран для сида. Не следует молча отбрасывать неизвестные поля
в серверном импортёре или подменять координаты Core.
