## 1. `apps/client` — конфигурация и manifest

- [x] 1.1 Добавить типизированное чтение `VITE_COMPOSE_PREVIEW_PLUGIN_URL` и описать переменную в
  `.env.example`.
- [x] 1.2 Реализовать manifest loader с разрешением `entrypoint` относительно plugin base URL.
- [x] 1.3 Добавить runtime validation `schemaVersion`, platform, protocol version, bridge message
  types и поддержки `BasicButton`.
- [x] 1.4 Покрыть manifest loader success/error tests, включая некорректный URL, HTTP failure и
  несовместимый manifest.

## 2. `apps/client` — `ComposePreviewSession`

- [x] 2.1 Добавить минимальные TypeScript types для plugin manifest, transport envelopes и
  `PreviewResult`, не дублируя полную модель `PreviewPayload`.
- [x] 2.2 Реализовать session lifecycle ready/send/result/reload/dispose с одним window message
  listener и очисткой timers.
- [x] 2.3 Проверять точное совпадение `event.source` с iframe window и `event.origin` с origin
  manifest entrypoint.
- [x] 2.4 Реализовать уникальный `requestId`, pending request correlation, timeout и корректную
  обработку `superseded`.
- [x] 2.5 Добавить unit tests для ready, source/origin filtering, success/failure correlation,
  timeout, reload и disposal.

## 3. `apps/client` — Compose preview UI

- [x] 3.1 Добавить `ComposePreviewFrame`, который создает iframe/session и отображает loading,
  rendering и failure states без перезагрузки iframe при каждом payload.
- [x] 3.2 Задать iframe `title`, размеры и минимальные sandbox permissions; не включать plugin
  artifact в Vite bundle или `public`.
- [x] 3.3 Добавить canonical полный `BasicButton` integration fixture, согласованный с Preview
  Protocol v1 и текущим Core Compose plugin.
- [x] 3.4 При каждой отправке создавать новый `requestId` и не позволять result устаревшего
  request изменить status актуального render.
- [x] 3.5 Добавить component tests для lifecycle `ComposePreviewFrame` и сохранения последнего
  успешного preview при последующей ошибке.

## 4. `apps/client` — интеграция в component editor

- [x] 4.1 Добавить в `ComponentEditorPreview` selector renderer mode `React / Compose`.
- [x] 4.2 Сохранить текущий `useStory`, CSS variables, preview wrapper и controls в React mode
  без изменения поведения.
- [x] 4.3 Показывать Compose mode только для пилотной кнопки и совместимого plugin manifest.
- [x] 4.4 Передавать в Compose host canonical Button fixture и повторно отправлять полный payload
  при поддержанном тестовом изменении token/property/example prop.
- [x] 4.5 Не добавлять преобразование `Config`, `Theme`, variations или db-service entities в
  `PreviewPayload`.

## 5. Browser verification и документация

- [x] 5.1 Документировать запуск production artifact `preview-compose-plugin` по отдельному
  локальному HTTP URL и настройку `VITE_COMPOSE_PREVIEW_PLUGIN_URL`.
- [x] 5.2 Добавить browser smoke scenario с React client и настоящим plugin на разных origins:
  manifest -> ready -> payload -> success.
- [x] 5.3 Проверить вторую отправку полного Button payload и обновление preview без reload iframe.
- [x] 5.4 Выполнить `npm run build` и `npm run lint` в `apps/client`, а также добавленные
  focused unit/component/browser tests.
- [x] 5.5 Зафиксировать результат PoC и подтвердить, что payload assembler, backend changes,
  plugin publication/catalog/signature и поддержка других компонентов не попали в scope.
