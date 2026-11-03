# local-web-preview-plugin Specification

## Purpose
TBD - created by archiving change publish-web-preview-plugin. Update Purpose after archive.
## Requirements
### Requirement: Архив web-плагина собирается из исходников

`js/apps/preview-web-plugin` SHALL иметь команду упаковки (`npm run package`), которая собирает плагин и пишет `local-dev/web-preview/preview-web-plugin.zip`. В `preview-plugin.json` архива SHALL быть записаны `commit` (sha текущего коммита репозитория), `version` (первые 12 символов `commit`), `plasmaNewHopeVersion` и `apiMetaSha256` файла `api-meta.json` архива. Команда SHALL обновлять блок происхождения архива в `local-dev/README.md`. При незакоммиченных изменениях в `js/apps/preview-web-plugin` команда MUST завершаться ошибкой, чтобы `commit` описывал содержимое архива.

#### Scenario: Упаковка

- **WHEN** разработчик выполняет `npm run package` на чистом рабочем дереве
- **THEN** появляется `local-dev/web-preview/preview-web-plugin.zip`, manifest которого содержит `commit`, `version` и верную `apiMetaSha256`

#### Scenario: Незакоммиченные правки плагина

- **WHEN** в `js/apps/preview-web-plugin` есть незакоммиченные изменения
- **THEN** упаковка MUST завершиться ошибкой с указанием причины

### Requirement: Локальный контур публикует web-плагин в MinIO

`setup-local.sh` и `setup-local.ps1` SHALL после публикации Compose-плагина публиковать web-плагин из `local-dev/web-preview/preview-web-plugin.zip` командой `dsbuilder preview-plugin publish --platform react --apply` той же служебной учёткой. Архив SHALL переопределяться флагом (`--web-plugin-zip` / `-WebPluginZip`) или переменной `WEB_PREVIEW_PLUGIN_ZIP`; флаг `--skip-plugin` / `-SkipPlugin` SHALL пропускать публикацию обоих плагинов. Локальный MinIO SHALL иметь бакет `web-preview` с анонимным чтением, а ds-service — настройки хранилища web на этот бакет. Клиент локального контура SHALL получать адрес web-плагина у бэкенда; контейнер `preview-web-plugin` MUST NOT запускаться при настройке контура.

#### Scenario: Настройка контура

- **WHEN** разработчик выполняет `./setup-local.sh`
- **THEN** web-плагин MUST быть опубликован в бакет `web-preview` локального MinIO, а превью web-компонентов в редакторе MUST загружаться оттуда

#### Scenario: Ошибка публикации архива по умолчанию

- **WHEN** публикация архива по умолчанию не удалась
- **THEN** настройка MUST продолжиться с предупреждением, а превью web-компонентов MUST показывать «Превью недоступно»

#### Scenario: Явно переданный архив

- **WHEN** архив передан флагом, а его публикация не удалась
- **THEN** настройка MUST завершиться ошибкой

