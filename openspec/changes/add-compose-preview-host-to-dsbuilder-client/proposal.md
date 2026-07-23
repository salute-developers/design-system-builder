## Why

Compose Preview Plugin уже поставляется как self-contained Wasm web artifact и предоставляет
двусторонний browser bridge с сообщениями `sdds.preview.ready`,
`sdds.preview.payload` и `sdds.preview.result`. Текущий React-клиент DS Builder умеет
показывать только локально зарегистрированные React stories через `useStory` и не имеет host,
который может загрузить Compose plugin в iframe и управлять его lifecycle.

Перед подключением реальной конфигурации редактора необходимо независимо проверить границу
client/plugin на canonical полном `BasicButton` payload. Это отделяет ошибки iframe transport от
будущих ошибок сборки effective tokens и component properties.

## What Changes

- В `apps/client` добавляется конфигурация базового URL Compose Preview Plugin.
- Добавляется TypeScript `ComposePreviewSession`, который загружает manifest, проверяет
  совместимость, управляет iframe lifecycle и коррелирует preview results по `requestId`.
- Добавляется React-компонент `ComposePreviewFrame` со состояниями loading, ready, rendering и
  failure.
- В `ComponentEditorPreview` добавляется переключение между существующим React preview и
  Compose preview для пилотной кнопки.
- Для первого vertical slice Compose host отправляет canonical полный `BasicButton` fixture и
  повторно отправляет его изменённую копию при изменении тестовых preview inputs.
- Добавляются проверки session lifecycle и browser integration с настоящим
  `preview-compose-plugin`.
- Существующий React renderer и `useStory` сохраняются без изменения их contract.
- Формирование `PreviewPayload` из `Config`, `Theme`, variation/style selection и backend-модели
  не входит в change.

## Capabilities

### New Capabilities

- `compose-preview-host`: React host для загрузки совместимого Compose/Wasm plugin, передачи
  полного preview payload и отображения коррелированного результата.

## Impact

- Затрагивается только `apps/client`.
- `services/db-service`, generator, publisher и admin client не меняются.
- Публичный backend API и модель данных не меняются.
- Добавляется runtime-конфигурация `VITE_COMPOSE_PREVIEW_PLUGIN_URL`.
- Может потребоваться локальная test dependency для unit/component tests browser session; выбор
  должен соответствовать текущему Vite/React toolchain.
- Production publication и discovery плагина, подпись artifact, каталог плагинов и формирование
  реального payload остаются вне scope.
- Для end-to-end проверки должен быть доступен собранный
  `plasma-android/integration-core/preview-compose-plugin` по HTTP.
