## Context

`apps/client/src/pages/components/features/ComponentEditorPreview` напрямую вызывает `useStory`.
`useStory` выбирает React story из ручного `componentMapper`, а компонент получает текущие
CSS variables через `StyledComponentWrapper`. Эта схема не может выполнить Compose component.

Compose Preview Plugin работает как отдельное web application:

```text
preview-plugin.json
index.html
preview-compose-plugin.js
*.wasm
```

Manifest protocol version 1 объявляет entrypoint, `BasicButton` и message types. После загрузки
iframe плагин отправляет `sdds.preview.ready`, принимает полный `PreviewPayload` и возвращает
`PreviewResult` с тем же `requestId`. Плагин уже реализует latest-request-wins.

## Goals / Non-Goals

**Goals:**

- Подключить существующий Compose/Wasm plugin к React-клиенту через изолированный iframe host.
- Проверять manifest и browser messages до передачи данных плагину.
- Иметь детерминированный lifecycle для ready, render result, timeout, reload и disposal.
- Показать настоящий `BasicButtonStory` по canonical payload в области component preview.
- Сохранить существующее React preview и дать пользователю явный выбор renderer.

**Non-Goals:**

- Сборка `PreviewPayload` из текущих `Config`, `Theme` или db-service entities.
- Сопоставление variation/style IDs и effective properties.
- Изменение Preview Protocol, Compose plugin или его manifest.
- Копирование или сборка Kotlin/Wasm artifact средствами Vite.
- Production plugin catalog, artifact publication, signature verification и access control.
- Поддержка остальных Compose-компонентов.
- Замена React preview либо удаление `useStory`.

## Decisions

### 1. Client получает URL уже опубликованного plugin artifact

`VITE_COMPOSE_PREVIEW_PLUGIN_URL` содержит URL каталога self-contained artifact, например:

```text
http://localhost:8080/
https://preview.example.com/compose/core/current/
```

Client загружает `preview-plugin.json` относительно этого URL и строит iframe URL через
`new URL(manifest.entrypoint, pluginBaseUrl)`. JS/Wasm файлы не копируются в `apps/client/public`
и не включаются в Vite bundle.

Отсутствующая или некорректная переменная конфигурации переводит Compose preview в явное failure
state, не нарушая React preview.

### 2. Manifest проверяется до создания рабочей session

Host проверяет минимальную runtime-схему manifest:

- `schemaVersion === 1`;
- `platform === "compose"`;
- `protocolVersion === 1`;
- непустой относительный или абсолютный `entrypoint`;
- наличие payload, ready и result message types;
- наличие `BasicButton` для пилотного renderer.

Неизвестные дополнительные поля игнорируются. Несовместимый manifest не загружается в iframe.
Полная cryptographic trust verification остается вне scope.

### 3. Browser lifecycle инкапсулируется в `ComposePreviewSession`

Session является TypeScript boundary без зависимости от component editor model. Она:

- владеет iframe window reference и ожидаемым plugin origin;
- принимает manifest и iframe element/window;
- слушает только сообщения с совпадающими `event.source` и `event.origin`;
- переходит в ready только после совместимого `sdds.preview.ready`;
- отправляет envelope `sdds.preview.payload` с полным payload;
- хранит pending requests по уникальному `requestId`;
- завершает request только соответствующим `sdds.preview.result`;
- завершает pending requests ошибкой при timeout, iframe reload или disposal;
- удаляет event listeners и timers при disposal.

Payload остается JSON-compatible объектом. Host определяет только минимальные TypeScript types
transport envelope, manifest и `PreviewResult`; он не создает вторую полную доменную модель
Preview Protocol.

### 4. Host не скрывает latest-request-wins плагина

При каждом изменении входного payload React layer создает новый `requestId` и передает полный
payload. Host не объединяет payload и не реализует patch. `superseded` является нормальным
коррелированным failure предыдущего request и не заменяет состояние более нового request.

Результат, requestId которого уже не является актуальным для UI, завершает собственный Promise,
но не меняет отображаемый status нового render.

### 5. React wrapper отражает lifecycle, но не владеет protocol logic

`ComposePreviewFrame`:

- загружает manifest и создает session;
- рендерит iframe с `title` и минимальными sandbox permissions, необходимыми Compose/Wasm;
- показывает loading до ready;
- отправляет новый полный payload после ready и при его изменении;
- показывает rendering до результата актуального request;
- оставляет последний успешный iframe render видимым при ошибке следующего payload и выводит
  failure рядом с preview;
- корректно пересоздает session при смене plugin URL.

Protocol validation, correlation и origin checks остаются в `ComposePreviewSession`, чтобы их
можно было тестировать независимо от React.

### 6. Component editor получает явный renderer mode

В `ComponentEditorPreview` добавляется selector `React / Compose`. React mode сохраняет текущие:

- `useStory`;
- `StyledComponentWrapper`;
- CSS variables;
- story controls.

Compose mode доступен только для пилотной кнопки и совместимого plugin manifest. Он заменяет
содержимое preview viewport iframe, но не меняет панели выбора theme mode, background, variations
и story props. В этом change эти controls изменяют только локальную тестовую копию canonical
payload там, где существует однозначное тестовое соответствие; они не объявляются production
assembler.

### 7. Canonical Button fixture является временной integration boundary

Client хранит отдельный JSON-compatible fixture, согласованный с canonical browser fixture
`preview-compose-plugin`. Fixture содержит:

- platform `compose` и protocol version 1;
- normalized theme tokens;
- effective `BasicButton` properties;
- interaction-state values;
- shape, typography и dimensions;
- example props.

На каждую отправку host заменяет fixture `requestId`. Fixture не импортирует `Config` и `Theme`,
не обращается к db-service и явно помечается как integration fixture. Следующий change
`connect-component-editor-to-compose-preview-payload` заменит fixture на application payload
source.

### 8. Проверки разделяют session и настоящий plugin

Unit/component tests используют контролируемый iframe/message source и проверяют:

- manifest compatibility;
- ready;
- source/origin filtering;
- request correlation;
- timeout;
- superseded result;
- reload/disposal cleanup.

Browser smoke test запускает React client и настоящий plugin на отдельных HTTP origins,
переключает renderer в Compose и подтверждает успешный Button render и второй полный payload без
reload iframe.

## Risks / Trade-offs

- [Canonical fixture может разойтись с plugin] -> Browser smoke test выполняется с настоящим
  production artifact; fixture имеет явную версию protocol и удаляется из render path следующим
  change.
- [Cross-origin iframe усложняет диагностику] -> Session проверяет source/origin и отображает
  manifest/ready/result failures отдельно.
- [Plugin ready может прийти до установки listener] -> Listener устанавливается до назначения
  iframe entrypoint либо iframe создается в контролируемой последовательности session.
- [Частые изменения controls создают много requests] -> Plugin latest-request-wins и host
  request correlation предотвращают применение устаревшего результата; debounce не вводится без
  измерений.
- [Sandbox flags влияют на Compose/Wasm] -> Используется минимальный подтвержденный набор
  permissions, а browser smoke test выполняется с теми же iframe attributes.

## Migration Plan

1. Добавить env-конфигурацию и manifest loader.
2. Реализовать и протестировать `ComposePreviewSession`.
3. Добавить `ComposePreviewFrame` и canonical Button fixture.
4. Добавить renderer selector в `ComponentEditorPreview`, сохранив React path.
5. Выполнить browser smoke test с опубликованным локально production artifact.

Rollback удаляет Compose mode, session и env variable; существующее React preview продолжает
работать без миграции данных.

## Open Questions

- Какой постоянный URL и release policy получит Core Compose Preview Plugin после PoC?
- Должен ли renderer mode сохраняться между сессиями пользователя или оставаться локальным
  состоянием страницы до появления общего platform selector?
