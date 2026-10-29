## Why

У `AvatarGroup` в Compose-превью нет текста в аватарах: круги залиты сплошным градиентом, а надпись (`textColor`) того же
градиента сливается с фоном. В приложении Android фон аватара прозрачный: `backgroundColor(surfaceDefaultAccentGradient.asLayered(0.2f))`.
В базе прозрачность есть (`Avatar.background`, `alpha = 0.2`), но до превью она не доходит:

- `GET /legacy/design-systems/{name}/component-configs` не отдаёт `alpha` значений, хотя колонка есть у всех трёх таблиц
  значений (инварианты, вариации, сочетания), а выгрузка конфигураций (`componentExport.ts`) её отдаёт;
- модель конфигурации клиента не читает `alpha`, поэтому ассемблер payload (уже умеющий слать `alpha`) получает пустое значение.

Прозрачность задана не только у аватара: `Editable`, `TextField`, `TextArea` (0.4) и `Spinner` (0.32) тоже выглядят в
превью иначе, чем в приложении.

## What Changes

- `component-configs` добавляет число `alpha` к значению свойства (инвариант, базовое значение вариации, значение
  состояния, значение сочетания), если оно хранится; нечисловой текст в колонке пропускается.
- Клиент хранит `alpha` в модели конфигурации и передаёт его в payload для цветовых значений и градиентов. Web-превью
  и панель свойств `alpha` не используют.
- Плагин применяет `alpha` к градиентам (парный change `apply-alpha-to-gradient-properties` в `plasma-android`):
  сейчас для токена-градиента он игнорируется.

## Capabilities

### New Capabilities

- `component-value-alpha`: прозрачность значения свойства от базы до превью.

### Modified Capabilities

Нет.

## Impact

- `js/services/db-service`: `routes/api/legacy.ts`, тест `legacy-component-configs-platform.test.ts` (или соседний).
- `js/apps/client`: типы и модель конфигурации (`controllers/componentBuilder`), `composePreview/draft.ts`, тесты.
- `plasma-android`: плагин (парный change).
- Схема базы и формат payload не меняются: колонки `alpha` и поле `alpha` у `literal` и `tokenRef` уже есть.
- Не входит: редактирование прозрачности в панели свойств, `alpha` у не цветовых свойств.
