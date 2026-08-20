## Context

CLI `dsbuilder` уже хранит project-scoped context в ближайшем `.sdds/config.json` и использует его для команд `status` и `theme fetch`. После `theme fetch` в config сохраняются non-secret metadata tenants: `id`, `designSystemId`, `name`, `description`, `directoryPath`, `createdAt`, `updatedAt`.

Проблема в том, что backend `tenant.id` неудобен для ручной работы, а `tenant.name` может быть длинным, нестабильным или плохо подходить для CLI-команд. Нужен локальный user-defined alias, который живет рядом с tenant metadata и не становится частью backend API.

## Goals / Non-Goals

**Goals:**

- Хранить alias как optional поле `alias` в `tenants[]` внутри `.sdds/config.json`.
- Добавить команды `dsbuilder theme alias list`, `dsbuilder theme alias set` и `dsbuilder theme alias unset`.
- Сохранять aliases при `theme fetch`, если backend tenant имеет тот же `id`.
- Валидировать уникальность alias внутри текущего project config.
- Сохранить существующее правило: config не содержит raw API key, API URL и runtime secrets.

**Non-Goals:**

- Не добавлять backend API для aliases.
- Не синхронизировать aliases между разработчиками вне обычного обмена `.sdds/config.json`.
- Не менять layout generated theme files.
- Не добавлять новую persistence технологию или dependency.
- Не вводить глобальные user-level aliases вне project config.

## Decisions

### Alias хранится в `tenants[].alias`

Alias будет optional полем существующей модели tenant config:

```json
{
  "id": "tenant-a",
  "designSystemId": "design-system-a",
  "name": "SDDS CS",
  "description": "Tenant",
  "directoryPath": ".sdds/sdds_cs",
  "alias": "main",
  "createdAt": "2026-06-04T07:37:55.526Z",
  "updatedAt": "2026-06-04T07:37:55.526Z"
}
```

Причина: alias относится к конкретному tenant и читается вместе с остальной локальной metadata. Это проще для пользователя и для CLI, чем отдельная map-структура.

Альтернатива: `tenantAliases: { "main": "tenant-a" }` на верхнем уровне config. Она лучше защищает aliases от полной перезаписи `tenants`, но добавляет отдельную модель консистентности: stale aliases, aliases на удаленные tenants и дополнительный lookup слой.

### `theme fetch` делает merge локального alias по `tenant.id`

`theme fetch` продолжит брать authoritative tenant metadata из backend, но перед записью config должен прочитать старые tenants и перенести `alias` для matching `tenant.id`.

```text
existing config tenants:
tenant-a -> alias "main"

backend tenants:
tenant-a -> fresh name/description/updatedAt

written config tenants:
tenant-a -> fresh backend metadata + alias "main"
```

Если tenant больше не приходит из backend, его entry и alias удаляются вместе с ним. Это сохраняет простую модель: aliases существуют только для tenants, известных текущему backend response.

### Alias management остается внутри `feature.theme`

Команды aliases относятся к работе с themes и tenants, поэтому command surface должен быть под `theme alias`, а не top-level `config`.

Предлагаемая CLI surface:

```bash
dsbuilder theme alias list
dsbuilder theme alias set --tenant-id tenant-a --alias main
dsbuilder theme alias unset main
```

Presentation слой отвечает за Clikt options и user-facing output. Application слой содержит use cases и validation. Data слой использует `ProjectConfigStore`/`CliFileSystem` для чтения и записи config. Domain слой содержит правила alias value и уникальности, если они выделяются в отдельную модель.

### Alias validation должна быть локальной и детерминированной

Минимальные правила:

- alias не пустой после trim;
- alias уникален среди `tenants[].alias` в текущем config;
- `set` требует существующий `tenant.id`;
- `unset` требует существующий alias;
- alias не содержит whitespace-only значение.

Более строгий character whitelist можно добавить, если появятся команды, где alias используется как path segment или file name. В рамках этого изменения alias остается config identifier и не влияет на filesystem layout.

### Совместимость config

Config без `alias` остается валидным. Новый CLI будет читать старые configs и записывать `alias` только при явной команде `theme alias set`.

Текущий `ProjectConfigCodec` использует strict parsing. После добавления поля `alias` старые CLI binary могут не прочитать config, записанный новым CLI. Для локального CLI это приемлемый trade-off на уровне продукта, но реализация может отдельно рассмотреть `ignoreUnknownKeys = true`, если нужна forward compatibility для локальных config files.

## Risks / Trade-offs

- [Risk] `theme fetch` случайно сотрет aliases при обновлении tenants. → Mitigation: вынести merge aliases в тестируемую функцию/use case и покрыть scenario "preserve aliases by tenant id".
- [Risk] Alias начнет восприниматься как backend identity. → Mitigation: specs и output должны явно держать alias как local-only metadata; HTTP clients не получают alias.
- [Risk] Неочевидное поведение при удалении tenant в backend. → Mitigation: зафиксировать, что alias удаляется вместе с отсутствующим tenant.
- [Risk] Старый CLI не читает config с новым полем. → Mitigation: config без alias остается валидным; forward compatibility можно усилить отдельным решением в codec.
- [Risk] Слишком свободный alias формат усложнит будущие команды. → Mitigation: пока не использовать alias как filesystem path; при первом таком сценарии добавить отдельное requirement для allowed pattern.

