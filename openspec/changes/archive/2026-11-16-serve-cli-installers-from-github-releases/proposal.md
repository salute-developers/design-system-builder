## Why

Публичные S3 URL установщиков возвращают HTML приложения; доступа к внешнему nginx нет.
Установщики нужно раздавать через GitHub Releases вместе с уже опубликованными архивами CLI.

## What Changes

- **BREAKING**: публичные ссылки установки переходят с домена Plasma на GitHub Releases.
- `install.sh` и `install.ps1` входят в проверяемый комплект assets каждого CLI-релиза.
- Публикация CLI больше не требует AWS secrets и переменных S3.
- Повтор старого опубликованного релиза добавляет недостающие установщики, сохраняя архивы и Latest.
- Документация содержит ссылки Latest и конкретного тега.

## Capabilities

### New Capabilities

### Modified Capabilities

- `cli-release-delivery`: GitHub Releases раздаёт и проверяет bootstrap-установщики; S3 больше не участвует в выпуске CLI.

## Impact

`release.py`, Python-тесты, релизный workflow, инструкции CLI и контракт доставки OpenSpec.
Поведение скачанных установщиков и формат архивов остаются совместимыми.
