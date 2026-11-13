## Why

Web-превью `Skeleton` пустое и локально, и на DEV. Story по умолчанию рисует анимацию `shimmer`, а `LineSkeleton` из `@salutejs/plasma-new-hope` закрашивает её переменной `--plasma-skeleton-gradient-color`. В сидах `Skeleton` заданы только `fadeInColor`, `fadeOutColor` (цвета анимации `pulse`), `lineHeight` и `visibleLineHeight`; свойства `gradientColor` нет, хотя web-мета его объявляет. Переменная не задаётся, и линия остаётся прозрачной. Сгенерированный пакет дизайн-системы получает тот же пустой `shimmer`.

`plasma-b2c` для этой переменной использует токен `surface.default.skeleton-gradient`, и он есть в начальных значениях темы ds-service.

## What Changes

- В сидах ds-service (`component-seeds.json`) у `Skeleton` появляется свойство `gradientColor`, привязанное к вариации `view`, со значением `surface.default.skeleton-gradient` в стиле `default`.
- Новые дизайн-системы получают `Skeleton`, который виден в превью и в сгенерированном пакете. В существующих дизайн-системах значение задаётся `dsbuilder components push` пакета `Skeleton` после влития `fix-component-config-roundtrip`, без ручных правок.

## Capabilities

### New Capabilities

- `base-component-seeds`: содержимое сидов компонентов, из которых заполняется новая дизайн-система.

### Modified Capabilities

Нет.

## Impact

- **backend-kt:** `ds-service/feature-components/src/main/resources/component-seeds.json`; тест сидов, если он проверяет состав свойств.
- **frontend-kt, js:** код не меняется. Пакет для `seeds:update` в `js/cli` должен содержать то же значение, чтобы следующее обновление сидов его не потеряло.
- **Стенды:** сиды применяются только к новым дизайн-системам. Существующим дизайн-системам на DEV значение задаётся `dsbuilder components push`.
