## REMOVED Requirements

### Requirement: API meta import is recorded in the changes journal

**Reason**: Общий каталог API компонентов не принадлежит отдельной дизайн-системе, а целевая модель удаляет
`design_system_changes` и вычисляет журнал только из предметных редакций конкретной дизайн-системы.

**Migration**: Импорт API-меты перестаёт записывать `components:import-api-meta` в `design_system_changes`. Сам импорт
остаётся транзакционным и дополняющим; отдельный журнал административных операций при необходимости проектируется
другим изменением.
