## Why

Инструмент импорта web-компонента из plasma (`npm run component:import` в db-service) читает токены ядра и конфиг `sdds-serv`, переводит их в модель DS Builder и пишет prod-сид db-service. db-service уходит, сиды уходят вместе с ним, а заводить новые компоненты из plasma по-прежнему нужно. Логика разбора и правила приведения остаются ценными; меняется только то, куда инструмент пишет результат и откуда берёт имена токенов темы. Инструмент переезжает в `js/cli`, где уже живут генератор web, `generate-api-meta` и пакет plasma, и пишет пакет `.sdds/components`, который заливает `dsbuilder components push`.

## What Changes

- `import-plasma-component.ts` переезжает в `js/cli/src/import-plasma-component.ts` со скриптом `npm run import:plasma -- --component=<X>`; разбор `tokens.ts` и `sdds-serv` конфигов, классификация значений, отчёт «ТРЕБУЕТ РЕШЕНИЯ / ПРИБЛИЖЕНИЯ / ПРОПУЩЕНО / СПРАВКА», режимы `--dir` для составных компонентов, `--alias`, `--skip-style`, `--default`, `--manifest`, `--remove` сохраняются.
- **BREAKING** для инструмента: вместо папки сида он пишет конфигурации в пакет `.sdds/components` в native-формате пакета (`<component>_<style>_config.json` и запись в `meta.json`), по одному файлу на appearance; `--remove` убирает файлы компонента и записи из `meta.json`.
- Имена и типы токенов темы и пиксельные значения токенов формы для сверки радиусов берутся из локальных данных `.sdds/tenants/<тема>` (`dsbuilder theme fetch`), а не из `seeds/prod/tokens.ts`.
- Шаблоны web-параметров (`0 $1`) и `adjust` в базу не идут: по решению от 2026-10-20 они уезжают на уровень генератора. Инструмент пишет шаблоны в манифест генератора `src/generator/templates/<X>/component.json` в поле `webTemplates`; генератор их читать начнёт отдельным change.
- Связи `component_deps` составного компонента инструмент не пишет: он печатает в отчёте пары «родитель → дочерний», а заводит их скилл через API `POST /ds/component-deps`.
- Скилл `add-component` переписывается на цепочку: `theme fetch`, `generate:api-meta` и `components import-api --platform react` для глобального слоя, `import:plasma`, `components push --platform react --apply` только пакета нового компонента, связи через API, стори клиента, проверка генератором.
- Из db-service удаляются `import-plasma-component.ts` и скрипт `component:import`; `js/docs/component-creation.md` описывает новую цепочку.

## Capabilities

### New Capabilities

- Нет.

### Modified Capabilities

- `plasma-component-import`: требования переписываются под выход в пакет `.sdds/components`, источник имён токенов в `.sdds/tenants`, шаблоны в манифесте генератора и связи через отчёт; правила приведения значений не меняются.

## Impact

- `js/cli`: новый `src/import-plasma-component.ts`, модуль записи пакета (`meta.json`, native-конфиги) с тестами на `node:test`, скрипт `import:plasma` в `package.json`, `README.md`.
- `js/cli/src/generator/templates/<X>/component.json`: новое необязательное поле `webTemplates`.
- `js/services/db-service`: удалены `src/db/import-plasma-component.ts` и скрипт `component:import`; сиды и сидер не меняются.
- `.claude/skills/add-component/SKILL.md`, `js/docs/component-creation.md`: новая цепочка.
- `backend-kt`, `frontend-kt`, `js/apps/client`: без изменений. `push` пакета одного компонента перезаписывает только его appearance и чужих шаблонов не трогает.
