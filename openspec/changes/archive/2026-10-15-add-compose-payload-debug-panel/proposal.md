## Why

Payload уходит в плагин сообщением `postMessage`, поэтому в DevTools его не видно, а в клиенте он нигде не показывается.
Чтобы разобрать, почему Compose-превью выглядит так, а не иначе, или приложить payload к описанию ошибки, приходится
вручную подписываться на сообщения в контексте `iframe` плагина. Разработчику нужен способ посмотреть и скопировать
payload прямо в редакторе.

## What Changes

- Под превью Compose-компонента появляется сворачиваемый блок «Payload» с JSON последнего собранного payload и кнопкой
  «Копировать».
- Блок виден только в debug-режиме (`localStorage.setItem('debug_mode', 'true')`) и только когда компонент рисуется
  Compose-renderer; в обычном режиме клиент не меняется.
- Показывается payload в том виде, в котором его собирает клиент (без `requestId`, который сессия добавляет при отправке).

## Capabilities

### New Capabilities

- `compose-payload-debug-panel`: просмотр и копирование payload Compose-превью в debug-режиме.

### Modified Capabilities

Нет.

## Impact

- `js/apps/client`: компонент `ComposePayloadDebug`, `ComponentEditorPreview`, тесты.
- Плагин, backend, контракт Preview Protocol и описание payload не меняются.
