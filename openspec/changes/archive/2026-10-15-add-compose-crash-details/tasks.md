## 1. Плагин (`plasma-android#945`)

- [x] 1.1 `index.html`: `reportCrash` сохраняет `crashDetails` (`stack`, `consoleError`, длина ограничена), `lastConsoleError` хранит текст и stack.
- [x] 1.1a `Main.kt`: обёртка над содержимым превью перехватывает исключения layout и отдаёт причину в JS (`__sddsPreviewCrashCause`).
- [x] 1.2 `render_crashed` и `plugin_crashed` отдают `details`.
- [x] 1.3 Браузерный тест: оба отказа сбоя layout содержат `details.stack` или `details.consoleError`.

## 2. Клиент

- [x] 2.1 Типы: необязательное `details` у `PreviewResultFailure` и отказа описания.
- [x] 2.2 Общий хелпер копирования, `ComposePayloadDebug` использует его.
- [x] 2.3 `ComposePreviewFrame`: сохраняет `details` отказа и сбоя и в debug-режиме показывает блок «Причина» с копированием.
- [x] 2.4 Описание `details` в `backend-kt/preview/contract/README.md`.

## 3. Проверка

- [x] 3.1 Тесты клиента: блок виден в debug-режиме при `details`, нет без debug-режима и без `details`, копирование.
- [x] 3.2 Проверка в браузере на реальном падении плагина (`TextSkeleton`: текст причины есть, stack нет — сбой в композиции).
