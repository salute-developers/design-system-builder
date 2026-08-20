## Context

`dsbuilder theme fetch` уже использует project-scoped context из `.sdds/config.json`, загружает tenants, token meta и token values, а затем пишет локальные artifacts в `.sdds`. Для полной локальной темы теперь нужен еще один remote artifact: palette, доступная по `GET /api/projects/{projectId}/ds/palette`.

Палитра приходит как flat JSON array `PaletteItem`, но локальным consumers нужен lookup object по `shade` и `saturation`. Изменение остается внутри CLI: backend API, авторизация `ProjectKey`, discovery config и текущий tenant/token layout не меняются.

## Goals / Non-Goals

**Goals:**

- Добавить загрузку palette в общий flow `theme fetch`.
- Ввести DTO для backend `PaletteItem` и доменную модель локальной palette projection.
- Преобразовывать array `PaletteItem` в объект `{ "$shade": { "$saturation": "$value" } }`.
- Писать palette в `.sdds/tenants/palette.json`.
- Сохранять путь до palette в `.sdds/config.json` как `palettePath`.
- Сохранять atomic behavior: при ошибке загрузки, парсинга или преобразования не оставлять partial theme files.

**Non-Goals:**

- Не менять backend endpoint, persistence, authorization и gateway routing.
- Не добавлять отдельную CLI-команду для palette.
- Не менять формат `Tenant`, `Token` и `TokenValue`.
- Не менять alias commands, кроме корректного сохранения неизвестных/новых config fields при записи.
- Не добавлять миграцию для уже существующих `.sdds` без `palettePath`; отсутствие поля остается валидным.

## Decisions

### Palette загружается как часть `theme fetch`

Palette нужна вместе с tenants и token values, поэтому `theme fetch` должен получать ее в том же use case и включать в единый write plan. Это позволяет сохранить один command для синхронизации локальной темы и одну точку atomic validation.

Альтернатива: сделать отдельную команду `theme palette fetch`. Это уменьшило бы blast radius текущего flow, но потребовало бы отдельного lifecycle и позволило бы локальной palette рассинхронизироваться с tenants/tokens после обычного `theme fetch`.

### Backend DTO остается в data layer

DTO `PaletteItem` должен жить рядом с существующими remote DTO CLI backend client. Application/domain слой должен получать уже распарсенную palette collection или domain projection без Ktor/client details.

Альтернатива: прокинуть raw JSON до writer. Это упростило бы client code, но перенесло бы backend contract и validation в filesystem adapter.

### Преобразование palette выполняется до записи файлов

Write plan должен содержать готовый локальный object format palette. `LocalThemeFileWriter` отвечает за путь и JSON запись, но не за semantic grouping. Это сохраняет текущую границу: application/domain формирует валидный план, data writer выполняет filesystem effects.

Альтернатива: группировать `PaletteItem` в writer. Это смешивает формат remote API, business validation и локальную запись.

### `palettePath` хранится в `.sdds/config.json`

Config должен получить optional top-level поле `palettePath` со значением `.sdds/tenants/palette.json`. Поле не содержит secrets, не зависит от runtime `--api-url` и может использоваться локальными consumers без повторного discovery файловой структуры.

Альтернатива: хранить путь внутри каждого tenant entry. Palette является project-level artifact, а не tenant-level artifact, поэтому top-level field проще и не дублирует один и тот же путь.

### Конфликты shade/saturation разрешаются детерминированно

Если backend вернул несколько `PaletteItem` с одинаковыми `shade` и `saturation`, CLI должен использовать последнюю запись из response order. Такой подход повторяет обычную map projection семантику и не требует угадывать, какой `type` важнее.

Альтернатива: падать на duplicate key. Это строже, но может заблокировать локальную синхронизацию из-за backend data, которая уже имеет определенный порядок выдачи.

## Risks / Trade-offs

- [Risk] Consumers могут ожидать отсутствие `palettePath` в config. → Mitigation: сделать поле optional при чтении и добавлять его только после успешного `theme fetch`.
- [Risk] Duplicate `shade`/`saturation` могут скрыть одно значение. → Mitigation: покрыть deterministic last-write-wins тестом и при необходимости позже усилить backend validation.
- [Risk] Ошибка palette endpoint начнет ломать весь `theme fetch`. → Mitigation: это ожидаемое поведение, потому что palette теперь часть required local theme artifacts; ошибка должна быть детерминированной и без secrets.
- [Risk] Writer может оставить старый `palette.json` после failed fetch. → Mitigation: применять тот же atomic/staging подход, что и для остальных theme files, и обновлять `config.json` только после успешной записи всех artifacts.

## Migration Plan

1. Добавить remote DTO и client method для `GET /api/projects/{projectId}/ds/palette`.
2. Расширить `theme fetch` application flow/write plan локальной palette projection.
3. Расширить local writer записью `.sdds/tenants/palette.json` и обновлением `palettePath` в config.
4. Обновить config model/serialization, сохранив обратную совместимость для config без `palettePath`.
5. Добавить unit tests для palette transformation, backend parsing failure и config persistence.
6. Проверить `dsbuilder-frontend/cli` через `./gradlew test`, `./gradlew spotlessCheck`, `./gradlew detekt` и при необходимости `./gradlew build`.

Rollback: удалить вызов palette endpoint, запись `palette.json` и обновление `palettePath`. Existing configs с `palettePath` должны продолжать парситься или игнорироваться как optional metadata.

## Open Questions

- Нет открытых вопросов для proposal-уровня; implementation может уточнить имена internal classes по текущему стилю `dsbuilder-frontend/cli`.
