## Why

Шаблоны многозначных web-параметров (`0 $1`, `0.25rem $1`) генератор web-пакета сейчас берёт из `.sdds/web/web-adapter.json`, который `components fetch` выгружает из базы `ds-service`. Хранить шаблоны в базе решено не продолжать: их оттуда удалят, а у новых компонентов (Attach, Autocomplete, Calendar, DatePicker и др.) шаблонам попасть в базу некуда — `components push` их не передаёт. Без шаблонов многозначные отступы новых компонентов в собранном пакете получают одно число вместо `a b`.

## What Changes

- В `js/cli` появляется статический `web-adapter.json` — имена, описания, шаблоны web-параметров по стилям и `compose`-связи компонентов. Файл идентичен `js/apps/preview-web-plugin/src/data/web-adapter.json`; дублирование осознанное до задачи о переиспользуемых механизмах CLI и web-плагина.
- `generate:components` и `generate:ds` по умолчанию читают этот файл, а не `<sdds>/web/web-adapter.json`. **BREAKING** для локальной генерации: шаблоны, имена, описания и `compose` из выгрузки базы больше не используются без явного `--web`.
- Флаг `--web <каталог>` остаётся явной подменой источника.
- В обе копии добавляются записи 23 новых web-компонентов, шаблоны 11 из них берутся из манифестов `import:plasma` (`webTemplates`).
- Тест `js/cli` проверяет, что обе копии совпадают побайтно.
- Генератор перестаёт падать на стиле без значений (в выгрузке нет поля `props`).
- Поле `webTemplates` убирается из манифестов генератора: его никто не читает. `import:plasma` больше не пишет шаблоны в манифест, а печатает их в отчёте готовым фрагментом записи `web-adapter.json` для переноса в обе копии.
- Шаблоны в базу не заносятся; выгрузка `web-adapter.json` командой `components fetch` не меняется.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `local-web-generation`: источник `web-adapter.json` — статический файл `js/cli`, а не `<sdds>/web`; генерация не падает на стилях без значений.
- `web-preview-plugin`: `web-adapter.json` бандла плагина должен совпадать с копией в `js/cli`.
- `plasma-component-import`: шаблоны web-параметров печатаются в отчёте для `web-adapter.json`, а не пишутся в `webTemplates` манифеста.

## Impact

- **js**: `js/cli/src/components-input.ts`, `js/cli/src/component-source.ts`, справка `components.ts` и `ds.ts`, новый `js/cli/src/data/web-adapter.json` (входит в публикуемый пакет через `files: src`), новый тест совпадения копий; `js/cli/src/import-plasma-component.ts` и его тест, 11 манифестов `js/cli/src/generator/templates/<X>/component.json` без `webTemplates`; `js/apps/preview-web-plugin/src/data/web-adapter.json` дополняется записями новых компонентов.
- **frontend-kt**: без изменений — `dsbuilder components fetch` продолжает писать `.sdds/web/web-adapter.json`, но генератор его по умолчанию не читает.
- **backend-kt**: без изменений; ручка `POST /ds/component-config/web-adapter` и шаблоны в базе остаются до отдельного удаления.
- Документация: `js/cli/README.md` и скилл `add-component` — где лежит `web-adapter.json` и что шаблоны нового компонента дописываются в обе копии.
