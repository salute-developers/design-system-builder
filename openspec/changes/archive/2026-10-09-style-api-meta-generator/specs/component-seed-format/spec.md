# Spec Delta

## ADDED Requirements

### Requirement: Base design system is seeded with a published version

The prod seed SHALL give the `base` design system a published version, because component export refuses a design
system without one.

#### Scenario: Пустая история версий

- **WHEN** `base` has no published version
- **THEN** the seed MUST insert published version `0.1.0`
- **WHEN** `base` already has a published version
- **THEN** the seed MUST NOT insert another one
