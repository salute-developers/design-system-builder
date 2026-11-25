## 1. Ширина числового поля

- [x] 1.1 `NumberControl`: ширина ввода по `measureText` текста значения в шрифте поля + 2 px, не меньше `1ch`; пересчёт при смене значения и после `document.fonts.ready`; без canvas — `calc(Nch + 2px)`; убрать проверку `field-sizing`
- [x] 1.2 `inspector-controls.css`: убрать `field-sizing: content` у `.component-number-control > input`, `is-raw` не трогать
- [x] 1.3 Обновить тест ширины ввода в `InspectorControls.test.tsx`

## 2. Проверка

- [x] 2.1 WebKit 26 и Chrome (Playwright): у значений `40`, `8`, `1234.5`, `-0.75`, `calc(100% - 8px)` ширина содержимого ввода не больше ширины поля; после повторного фокуса и стрелок `40 %` видно целиком
- [x] 2.2 `cd js && npm run build` и тесты клиента
