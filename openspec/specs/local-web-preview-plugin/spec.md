# local-web-preview-plugin Specification

## Purpose
Определяет сборку архива web-плагина превью и его публикацию в MinIO при запуске локального контура DS Builder.

## Requirements
### Requirement: Архив web-плагина собирается из исходников

Пакет `packages/sdds-preview-web-plugin` репозитория plasma SHALL иметь команду упаковки (`npm run package`), которая собирает плагин и пишет `archive/preview-web-plugin.zip` в каталоге пакета.

#### Scenario: Дополнительные условия — Архив web-плагина собирается из исходников

- **WHEN** локальный контур упаковывает web-плагин из репозитория plasma
- **THEN** В `preview-plugin.json` архива SHALL быть записаны `commit` (sha текущего коммита plasma), `version` (первые 12 символов `commit`), `plasmaNewHopeVersion` и `apiMetaSha256` файла `api-meta.json` архива. Команда SHALL печатать блок происхождения архива для `local-dev/README.md` DS Builder и SHALL NOT менять файлы вне каталога пакета. При незакоммиченных изменениях в каталоге пакета команда MUST завершаться ошибкой, чтобы `commit` описывал содержимое архива. Архив для локального стенда DS Builder SHALL копироваться в `local-dev/web-preview/preview-web-plugin.zip` вместе с блоком происхождения.

#### Scenario: Упаковка

- **WHEN** разработчик выполняет `npm run package` в пакете на чистом рабочем дереве plasma
- **THEN** появляется `archive/preview-web-plugin.zip`, manifest которого содержит `commit`, `version` и верную `apiMetaSha256`, а в выводе — блок происхождения

#### Scenario: Незакоммиченные правки плагина

- **WHEN** в `packages/sdds-preview-web-plugin` есть незакоммиченные изменения
- **THEN** упаковка MUST завершиться ошибкой с указанием причины

#### Scenario: Обновление архива стенда

- **WHEN** разработчик обновляет плагин локального стенда DS Builder
- **THEN** он MUST скопировать архив в `local-dev/web-preview/preview-web-plugin.zip` и заменить блок `web-provenance` в `local-dev/README.md` напечатанным блоком

### Requirement: Локальный контур публикует web-плагин в MinIO

`setup-local.sh` и `setup-local.ps1` SHALL после публикации Compose-плагина публиковать web-плагин из `local-dev/web-preview/preview-web-plugin.zip` командой `dsbuilder preview-plugin publish --platform react --apply` той же служебной учёткой.

#### Scenario: Условия выполнения — Локальный контур публикует web-плагин в MinIO

- **WHEN** локальный контур публикует web-плагин в MinIO
- **THEN** Архив SHALL переопределяться флагом (`--web-plugin-zip` / `-WebPluginZip`) или переменной `WEB_PREVIEW_PLUGIN_ZIP`; флаг `--skip-plugin` / `-SkipPlugin` SHALL пропускать публикацию обоих плагинов.
- **AND** Локальный MinIO SHALL иметь бакет `web-preview` с анонимным чтением, а ds-service — настройки хранилища web на этот бакет.
- **AND** Клиент локального контура SHALL получать адрес web-плагина у бэкенда; контейнер `preview-web-plugin` MUST NOT запускаться при настройке контура.


#### Scenario: Настройка контура

- **WHEN** разработчик выполняет `./setup-local.sh`
- **THEN** web-плагин MUST быть опубликован в бакет `web-preview` локального MinIO, а превью web-компонентов в редакторе MUST загружаться оттуда

#### Scenario: Ошибка публикации архива по умолчанию

- **WHEN** публикация архива по умолчанию не удалась
- **THEN** настройка MUST продолжиться с предупреждением, а превью web-компонентов MUST показывать «Превью недоступно»

#### Scenario: Явно переданный архив

- **WHEN** архив передан флагом, а его публикация не удалась
- **THEN** настройка MUST завершиться ошибкой

