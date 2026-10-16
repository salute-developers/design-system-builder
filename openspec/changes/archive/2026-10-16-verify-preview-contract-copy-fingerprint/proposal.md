## Why

Копия схемы и общих фикстур Preview Protocol в `plasma-android` (`integration-core/preview-contract`) должна быть побайтово идентична
канонической в `backend-kt/preview/contract`, но это правило нигде не проверяется. Расхождение обнаруживается только случайно, когда
плагин и клиент по-разному разбирают payload. Копировать файлы приходится руками (так было при добавлении раздела `defaults`).

## What Changes

- Канонический каталог получает файл отпечатков `backend-kt/preview/contract/CONTRACT.sha256`: SHA-256 схемы и каждой общей фикстуры
  (формат `sha256sum`, пути относительно каталога контракта, сортировка по пути).
- Скрипт `backend-kt/preview/contract/fingerprint.sh` пересчитывает файл (`--write`) или сверяет его с содержимым (`--check`).
  DSB CI запускает `--check`: изменить схему или фикстуру и не обновить отпечатки нельзя.
- `plasma-android` хранит у себя копию `CONTRACT.sha256`. Проверка в её CI делает две вещи: пересчитывает отпечатки своих файлов
  и сравнивает с локальным `CONTRACT.sha256`; затем сравнивает локальный `CONTRACT.sha256` с каноническим из репозитория DSB. Первая проверка блокирует PR; вторая
  в PR только предупреждает, а в `release/*`, `hotfix/*`, `main` и в ночном запуске на `develop` завершается ошибкой.
- Сообщение об ошибке называет расходящиеся файлы и команду, которой копия обновляется (`fingerprint.sh --sync-to <каталог plasma>`).

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `preview-payload-contract`: проверка идентичности копии в `plasma-android` выполняется сверкой отпечатков в CI обоих репозиториев.

## Impact

- `backend-kt/preview/contract`: `CONTRACT.sha256`, `fingerprint.sh`, раздел в `README.md` (убрать упоминание «recorded digest», которого пока нет).
- `.github/workflows/validate-js.yml` (или отдельный workflow): шаг `fingerprint.sh --check` по пути `backend-kt/preview/contract/**`.
- `plasma-android`: `integration-core/preview-contract/CONTRACT.sha256`, тест или Gradle-задача сверки, шаг в CI, раздел в `README.md` модуля.
- Схема, фикстуры, плагин, клиент и версия протокола не меняются. Схемы результата и описания остаются только в `plasma-android`.
