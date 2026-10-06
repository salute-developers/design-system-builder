## Why

Плагин Android Studio / IntelliJ IDEA сейчас рендерит осмысленно только один тип токена — `color` (hex-квадрат). Для `gradient`, `typography`, `shadow`, `shape` и `spacing` пользователь видит сырой JSON-текст значения (`[{"kind":"round","cornerRadius":12}]` и т.п.) — ровно то, ради избежания чего плагин и задумывался: «посмотреть токены, не выходя из IDE». Разработчику приходится вручную парсить JSON в голове, что не даёт визуального превью и подрывает саму цель read-only браузера токенов. Реализация значений уже опубликована и обкатана в продакшене — библиотека `sdds-uikit-compose`, которую плагин уже подключает как зависимость (`sdds-uikit-compose:0.51.0`), содержит готовые примитивы для градиентов и теней, применимые без переизобретения.

## What Changes

- `TokenRow` в `TokenList.kt` получает превью значения для всех типов токенов, а не только `color`: `shape` — квадрат нужной формы, `spacing` — полоска нужной ширины с подписью, `gradient` — квадрат, залитый настоящим градиентным брашем, `shadow` — карточка с настоящей тенью, `typography` — текст-сэмпл, отрисованный тем же размером/начертанием/интерлиньяжем, что и токен.
- Значения `gradient` и `shadow` рендерятся через уже подключённую `sdds-uikit-compose` (`com.sdds.compose.uikit.graphics.Gradients.Linear/Radial/Sweep`, `com.sdds.compose.uikit.shadow.ShadowAppearance` + `Modifier.shadow`) — новой внешней зависимости это изменение не добавляет.
- `HttpDesignSystemDataClient`/`TokenValue` в модуле плагина перестают отдавать только `rawValue: String` (сырой JSON-текст или его `toString()`) — вводится типизированная модель распарсенного значения на основе того же per-type contract, что уже описан в `frontend-kt/feature-theme/.../TokenValueNormalizer.kt` (`color` — строка, `typography`/`shape`/`spacing` — объект, `gradient`/`shadow` — массив объектов), поверх которой строится превью.
- Область охвата — платформы `android` и `ios` (их JSON-формы для `shape`/`spacing`/`gradient`/`shadow` структурно совпадают; `typography` отличается именами полей между платформами и парсится раздельно в один общий вид). Значения платформы `web` (CSS-строки: `rem`, `linear-gradient(...)`, `box-shadow`) остаются отображаться как сырой текст, как сегодня, — не в скоупе этого изменения.
- `fontFamily` остаётся исключён из UI без изменений — решение уже принято и закомментировано в текущем коде (значение — только имя шрифта, показывать нечего).
- Плагин остаётся read-only: изменение не добавляет запись, редактирование или экспорт значений — только визуальное превью.

## Capabilities

### Modified Capabilities
- `ide-plugin-token-browser`: сценарий «Просмотр токенов выбранной дизайн-системы» расширяется — превью значения строится по типу токена (`color`, `gradient`, `typography`, `shadow`, `shape`, `spacing`) для платформ `android`/`ios`, вместо сырого JSON-текста для всех типов кроме `color`.

## Impact

- `frontend-kt/plugins/android-studio/.../tokens/HttpDesignSystemDataClient.kt` — `extractDisplayValue` заменяется/дополняется типизированным per-type разбором значения вместо частного случая «одноэлементный массив с примитивом».
- `frontend-kt/plugins/android-studio/.../tokens/DesignSystem.kt` — `TokenValue` получает типизированное представление значения в дополнение к (или вместо) `rawValue: String`.
- `frontend-kt/plugins/android-studio/.../ui/TokenList.kt` — `TokenRow` получает per-type ветки рендера вместо единственной ветки для `COLOR`.
- Зависимость `io.github.salute-developers:sdds-uikit-compose` уже объявлена в `frontend-kt/plugins/android-studio/build.gradle.kts` — новых записей в Gradle-файлах не требуется, используются уже доступные публичные классы (`Gradients`, `ShadowAppearance`).
- Бэкенд, REST-контракт (`GET /ds/token-values`), схема БД и OpenAPI не меняются — используются уже существующие и уже читаемые плагином данные.
