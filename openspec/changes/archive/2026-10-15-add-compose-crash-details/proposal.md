## Why

Когда Compose в плагине останавливается, клиент показывает только короткое `message` («Плагин остановился: …»). Stack
исключения плагин из `reportCrash` не отдаёт, а запись `console.error`, которой Compose-рантайм сообщает об исключении
в кадре, остаётся в консоли `iframe`. Чтобы понять причину падения (например, `Only Sp can convert to Px`), приходится
переключать контекст DevTools на `iframe` плагина и искать нужную запись вручную.

## What Changes

- Плагин добавляет в `failure`-результат необязательное поле `details`: `stack` исключения и `consoleError` — последняя
  запись `console.error` плагина. Версия протокола не меняется; клиент без поддержки поля его игнорирует.
- Клиент передаёт `details` из результата до `ComposePreviewFrame` и в debug-режиме показывает под плашкой сбоя
  сворачиваемый блок «Причина» со stack, консольной ошибкой и кнопкой «Копировать».
- Вне debug-режима и для плагина без `details` показ не меняется.

## Capabilities

### New Capabilities

- `compose-crash-diagnostics`: причина и stack падения плагина в результате и в debug-режиме клиента.

### Modified Capabilities

Нет.

## Impact

- `plasma-android` (парный PR `#945`): `index.html` плагина, браузерный тест.
- `js/apps/client`: `composePreview` (типы результата, `ComposePreviewFrame`), общий хелпер копирования, тесты.
- `backend-kt/preview/contract`: описание `details` в `README.md`; JSON-схема payload не меняется.
