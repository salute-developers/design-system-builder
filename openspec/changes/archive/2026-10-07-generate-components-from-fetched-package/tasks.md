# Tasks

## 1. db-service

- [x] 1.1 `buildWebGenerationMeta` (`db/export/webGenerationMeta.ts`) и ручка `POST /ds/component-config/web-meta`.
- [x] 1.2 `/export`: смещение из числовых поправок платформенных параметров, если колонка строки пуста (приоритет web, копии значения и нечисловые поправки отбрасываются).
- [x] 1.3 Тесты: `webGenerationMeta.test.ts` (шаблоны, compose только между компонентами пакета), `componentExport.test.ts` (смещение и его фильтр).
- [x] 1.4 OpenAPI и типы админки перегенерированы.

## 2. Fetch

- [x] 2.1 Порты `WebGenerationMetaSource`/`WebGenerationMetaWriter` по образцу legacy-снимка: загрузка до записи пакета, запись после, ответ как есть.
- [x] 2.2 Файлы пишутся в `web/` рядом с project config, без него — в `<to>/web`.
- [x] 2.3 `--platform` у `components fetch`; платформа выбирается `PlatformResolver` как у `components generate`, web-meta запрашивается только для React, невыбранная платформа fetch не отклоняет.
- [x] 2.4 Тесты use case и CLI: React из флага и из конфига, приоритет флага, несколько платформ, отказ ручки до записи.
- [x] 2.5 Проверка: `./gradlew build`; CLI установлен `install-local-cli.sh`, fetch на копии проекта пишет `.sdds/web` только для React.

## 3. Генерация в js/cli

- [x] 3.1 `src/component-source.ts` собирает `Meta` генератора из `.sdds/components` и `.sdds/web`.
- [x] 3.2 `generate:api-meta`: `--out` необязателен, по умолчанию `<sdds>/web/web-api-meta.json`, опция `--sdds`.
- [x] 3.3 Проверка: пакет из новых файлов совпадает с пакетом из `component-configs.json` по всем 207 файлам с точностью до порядка строк и пустого описания.

## 4. Данные

- [x] 4.1 Сиды `iconButton/properties.ts`, `list/properties.ts`.
- [x] 4.2 Исправление применено к локальной базе запросом (сидер только дописывает).
