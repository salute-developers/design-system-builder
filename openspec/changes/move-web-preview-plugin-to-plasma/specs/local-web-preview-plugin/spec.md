## MODIFIED Requirements

### Requirement: Архив web-плагина собирается из исходников

Пакет `packages/sdds-preview-web-plugin` репозитория plasma SHALL иметь команду упаковки (`npm run package`), которая собирает плагин и пишет `archive/preview-web-plugin.zip` в каталоге пакета. В `preview-plugin.json` архива SHALL быть записаны `commit` (sha текущего коммита plasma), `version` (первые 12 символов `commit`), `plasmaNewHopeVersion` и `apiMetaSha256` файла `api-meta.json` архива. Команда SHALL печатать блок происхождения архива для `local-dev/README.md` DS Builder и SHALL NOT менять файлы вне каталога пакета. При незакоммиченных изменениях в каталоге пакета команда MUST завершаться ошибкой, чтобы `commit` описывал содержимое архива. Архив для локального стенда DS Builder SHALL копироваться в `local-dev/web-preview/preview-web-plugin.zip` вместе с блоком происхождения.

#### Scenario: Упаковка

- **WHEN** разработчик выполняет `npm run package` в пакете на чистом рабочем дереве plasma
- **THEN** появляется `archive/preview-web-plugin.zip`, manifest которого содержит `commit`, `version` и верную `apiMetaSha256`, а в выводе — блок происхождения

#### Scenario: Незакоммиченные правки плагина

- **WHEN** в `packages/sdds-preview-web-plugin` есть незакоммиченные изменения
- **THEN** упаковка MUST завершиться ошибкой с указанием причины

#### Scenario: Обновление архива стенда

- **WHEN** разработчик обновляет плагин локального стенда DS Builder
- **THEN** он MUST скопировать архив в `local-dev/web-preview/preview-web-plugin.zip` и заменить блок `web-provenance` в `local-dev/README.md` напечатанным блоком
