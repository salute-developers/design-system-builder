## Why

Раздел «Компоненты» на DEV проверен вместе с наполнением web-компонентов sdds-serv (PLASMABLDR-226 в ветке PLASMABLDR-222), и теперь его нужно открыть пользователям PROM. Сейчас сборка PROM выключает раздел: на проде нельзя ни открыть редактор компонентов, ни посмотреть превью.

## What Changes

- Workflow публикации PROM (`.github/workflows/deploy-front-apps-prom.yml`) собирает клиент с `VITE_COMPONENT_EDITOR_ENABLED: 'true'`, как и DEV.
- Сам флаг и его поведение в клиенте не меняются: при другом значении раздел по-прежнему выключается, а production-сборка без значения его не показывает. Это позволяет быстро выключить раздел одной правкой workflow.
- `js/apps/client/README.md` описывает, что обе сборки, DEV и PROM, выполняются с включённым флагом.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `component-editor-feature-flag`: сборка PROM выполняется с включённым флагом.

## Impact

- `js`: workflow публикации клиента PROM и README клиента; код клиента не меняется.
- `backend-kt`, `frontend-kt`: не затронуты. Раздел PROM работает с компонентами из ds-service прода и web-плагином превью, опубликованным на стенд.
