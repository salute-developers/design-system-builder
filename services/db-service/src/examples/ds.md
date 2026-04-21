# Пользователи
- login: neretin, token: password
- login: client, token: client

# Дизайн системы

## SDDS 

packageName: sdds
description: Дизайн система для вертикали SDDS

Кто имеет доступ: neretin, client

### Версии

#### 0.1.0

Кто опубликовал: neretin
snapshot: полное состояние связанных сущностей на момент публикации в формате JSON
changelog: "Первая дизайн система"
publication_status: published

#### 0.2.0

Кто опубликовал: client
snapshot: полное состояние связанных сущностей на момент публикации в формате JSON
changelog: "Доработки по дизайн системе"
publication_status: failed

### Документация

Это контент для странички с документацией для дизайн системы SDDS

### Чендж-логи

Кто изменял: client
{
  "entity_type": "token_value",
  "entity_id": зависимый id,
  "operation": "update",
  "before": { "value": "#FF0000" },
  "after":  { "value": "#FF5500" }
}

Кто изменял: neretin
{
  "entity_type": "style",
  "entity_id": зависимый id,
  "operation": "create",
  "before": null,
  "after": { "name": "xxl", "variation_id": зависимый с size id, "is_default": false }
}

## PLASMA 

packageName: plasma
description: Дизайн система для вертикали PLASMA

Кто имеет доступ: neretin

#### 0.1.0

Кто опубликовал: neretin
snapshot: полное состояние связанных сущностей на момент публикации в формате JSON
changelog: "Первая дизайн система"
publication_status: published

### Документация

Это контент для странички с документацией для дизайн системы PLASMA

### Чендж-логи

Кто изменял: neretin
{
  "entity_type": "token_value",
  "entity_id": зависимый id,
  "operation": "update",
  "before": { "value": "#270bfc" },
  "after":  { "value": "#8800ff" }
}

Кто изменял: neretin
{
  "entity_type": "style",
  "entity_id": зависимый id,
  "operation": "create",
  "before": null,
  "after": { "name": "positive", "variation_id": зависимый c view id, "is_default": false }
}

# ВАЖНО

Пример структуры снашпота у опубликованных версий дизайн систем

{
  "tokens": [
    { "id": "uuid-1", "name": "dark.text.primary", "type": "color", "values": [...] }
  ],
  "components": [
    {
      "id": "uuid-2",
      "name": "Button",
      "properties": [...],
      "variations": [
        {
          "id": "uuid-3",
          "name": "size",
          "styles": ["s", "m", "l"],
          "property_values": [...]
        }
      ]
    }
  ],
  "appearances": [...],
  "tenants": [...]
}
