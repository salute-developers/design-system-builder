# Tasks

## 1. feature-components

- [x] 1.1 Удалить `ComponentConfigsSnapshotPorts.kt` и `ComponentConfigsSnapshotAdapters.kt`.
- [x] 1.2 `FetchComponentsUseCase`: убрать загрузку и запись снимка, поле `snapshotPath`; после пакета пишется только web-адаптер.
- [x] 1.3 DI: убрать регистрацию снимка.

## 2. CLI

- [x] 2.1 Вывод `components fetch` без строки `Component configs`.
- [x] 2.2 Тесты: убрать тесты снимка и путь legacy-ручки из фейковых HTTP-ответов; проверить, что fetch её не запрашивает.

## 3. Проверка

- [x] 3.1 `./gradlew build`; переустановка CLI. Живой fetch не прогнан: ключ в окружении истёк; отсутствие запроса legacy-ручки и сохранность старого файла проверены тестом CLI.
- [x] 3.2 `USAGE.md`, дельта `cli-components`.
