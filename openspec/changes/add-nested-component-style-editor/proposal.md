## Why

Свойство типа `component_style` задаёт стиль вложенного компонента (например, стиль кнопки внутри
поля ввода). В редакторе компонента `js/apps/client` оно показывается только для чтения текстом
`basic-button.xxs.default`: стиль вложенного компонента нельзя выбрать или поменять. Серверная часть
уже умеет записывать такие ссылки (`component-nested-style-references`), но клиент не вызывает эту
операцию.

## What Changes

- В панели свойств редактора компонента для свойства `component_style` вместо текстового поля
  показывается выбор: оформление целевого компонента, затем стиль по каждой оси этого оформления.
- Выбранное значение собирается в строку `оформление.стиль1.стиль2` в порядке осей и сразу
  отражается в превью (разворачивание ссылки в превью уже реализовано).
- Сохранение значения `component_style` выполняется операцией `PUT /api/ds/appearances/{id}/property-values`
  с полем `reference` (`targetAppearanceId`, `styleIds`), а не обычной записью значения или токена.
- Выбор доступен только в редакторе compose-компонентов (платформа `compose`); у компонентов других
  платформ `component_style` остаётся только для чтения, как сейчас.
- Очистка значения удаляет ссылку вместе со значением свойства.
- Ответы `reference_target_not_found`, `reference_invalid_styles`, `reference_cycle` и
  `reference_too_deep` показываются пользователю понятным сообщением.

Вне изменения: контракт и поведение `ds-service`, `frontend-kt`, рендер превью, остальные
платформы.

## Capabilities

### New Capabilities

- `component-editor-nested-style-selection`: выбор и запись стиля вложенного компонента в панели
  свойств редактора компонента.

### Modified Capabilities

Нет: требования `component-nested-style-references` не меняются.

## Impact

- `js/apps/client`: `ComponentEditorProperties` (элемент выбора), `controllers/componentBuilder`
  (`StyleReferenceProp`, `styleReference.ts` — обратное разворачивание в выбор и сборка строки),
  `api/componentAutosave.ts` и `api/componentRepository.ts` (изменение значения со ссылкой и вызов
  `PUT .../property-values`).
- `backend-kt` и `frontend-kt`: без изменений; используется существующая операция `ds-service`,
  `documentation.yaml` не меняется.
