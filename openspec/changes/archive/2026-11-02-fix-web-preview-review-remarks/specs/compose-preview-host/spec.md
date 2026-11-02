## ADDED Requirements

### Requirement: Хост показывает warnings успешного результата

Хост превью SHALL выводить в консоль браузера warnings результата `success`, не меняя при этом статус отрисовки.

#### Scenario: Плагин подменил шрифт

- **WHEN** плагин ответил `success` с warning `font_fallback`
- **THEN** хост MUST показать превью как успешное и вывести warning через `console.warn` с кодом и текстом
