# Spec Delta

## ADDED Requirements

### Requirement: Tenant token values expose palette references

`GET /tenants/:id/token-values` SHALL return a value bound to the palette as a palette reference string.

#### Scenario: Значение со ссылкой на палитру

- **WHEN** a token value has `paletteId`
- **THEN** its `value` MUST be `["[type.shade.saturation]"]`, or `["[type.shade.saturation][opacity]"]` when the stored value holds an opacity
- **THEN** values without `paletteId` MUST be returned unchanged
