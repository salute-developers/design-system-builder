## Why

В UI плагина Android Studio переключатель режима темы и фильтр по типу токенов сделаны на `Tabs`/`TabItem`, у которых приходится обнулять встроенные отступы. Семантически это выбор одного значения из набора, для чего в дизайн-системе есть `Segment`. При этом вертикальные отступы на экране токенов заданы неравномерно: каждый блок добавляет себе `padding(vertical = spacing2x)`, из-за чего между блоками получается 4x, а сверху и снизу 2x, и экран выглядит неаккуратно.

## What Changes

- `ModeSwitch` (Светлая/Тёмная) в `MainScreen.kt` переводится с `Tabs` на `SegmentHorizontal` + `SegmentItem`.
- `TokenTypeTabs` в `TokenList.kt` переводится на тот же `Segment`, обёрнутый в `horizontalScroll`: у `SegmentHorizontal` нет собственного скролла, а типов токенов может быть до семи.
- Фильтры экрана токенов (режим, тип, поиск) собираются в одну колонку с `Arrangement.spacedBy(spacing2x)`; она единственный владелец вертикального ритма. Внутренние `padding(vertical = 2x)` у трёх блоков убираются.
- Удаляются обходные приёмы обнуления `contentPaddingStart/End` у `Tabs` и `paddingStart/End` у `TabItem`.
- Обоим сегментам задаётся одинаковый стиль (`Segment.S.Primary`, уточняется по высоте относительно `TextFieldM`).
- Поведение не меняется: те же режимы, те же типы и порядок, то же сохранение выбора в `MainScreenState`.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `ide-plugin-token-browser`: добавляется требование к фильтрам экрана токенов — `Segment` из дизайн-системы, прокрутка сегмента типов в узком окне и ровный вертикальный ритм. Существующие требования (группировка по типу, выбор режима, сохранение состояния) не меняются.

## Impact

- `frontend-kt/plugins/android-studio`: `ui/MainScreen.kt`, `ui/TokenList.kt`, тест `TokenListTest`. Зависимости `sdds-uikit-compose` 0.51.0 и `sdds-serv-compose` 0.43.0 уже подключены, новых не нужно.
- `backend-kt` и `js` не затрагиваются.
- Публичная сигнатура `TokenList` может измениться (слот или параметры режима) — см. design.md.
