## 1. DSB

- [x] 1.1 `backend-kt/preview/contract/fingerprint.sh`: режимы `--write`, `--check`, `--sync-to <dir>`; сортировка по пути, LF.
- [x] 1.2 Сгенерировать `CONTRACT.sha256` для схемы и `fixtures/v1/{valid,invalid}`.
- [x] 1.3 CI: шаг `fingerprint.sh --check`, запускаемый по `backend-kt/preview/contract/**`.
- [x] 1.4 `backend-kt/preview/contract/README.md`: описать файл отпечатков и обновление копии.

## 2. plasma-android

- [x] 2.1 Локальный файл отпечатков - уже существующий `schemas/v1/DIGEST` (пути `fixtures/v1/shared/...`); `fingerprint.sh --sync-to` переписывает его, сверка нормализует пути.
- [x] 2.2 Пересчёт отпечатков собственных файлов - уже есть в `SchemaContractTest`; сообщение указывает на `fingerprint.sh --sync-to`.
- [x] 2.3 Шаг CI: скачать канонический `CONTRACT.sha256` с raw.githubusercontent.com (`DSB_CONTRACT_REF`, без токена; `.github/scripts/check-preview-contract.sh`, workflow `check-preview-contract.yml`), сравнить с локальным, вывести расходящиеся файлы; в PR - `::warning`, в `release/*`, `hotfix/*`, `main` - ошибка.
- [x] 2.4 Ночной запуск по расписанию на `develop` с той же сверкой (ошибка при расхождении).
- [x] 2.5 `README.md` модуля: как обновить копию.

## 3. Проверка

- [ ] 3.1 Правка байта в схеме DSB без `--write` роняет DSB CI; правка байта в копии plasma роняет её проверку.
- [ ] 3.2 PR в plasma с отставшей копией проходит с предупреждением, а та же копия в `release/*` падает.
- [ ] 3.3 Обновлённая копия проходит обе проверки.
