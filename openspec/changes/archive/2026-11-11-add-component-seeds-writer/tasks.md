## 1. Команда

- [x] 1.1 `js/cli/src/component-seeds.ts`: чтение пакета, перевод значений, слияние с сидами, запись файла
- [x] 1.2 Скрипт `seeds:update` в `js/cli/package.json`, справка команды
- [x] 1.3 Тесты: новый компонент, дополнительный appearance, пустой компонент, `token`/`value`, состояния, связи, неизменность неназванных записей и повторный запуск

## 2. Данные

- [x] 2.1 Дописать в сиды 27 новых компонентов и appearance `clear`/`transparent`/`has-wrapper` из пакетов импорта из ядра и sdds-serv (не из выгрузки стенда)
- [x] 2.2 Связи `reuse` новых компонентов (Group, Tour, Table, Overlay, Portal)
- [x] 2.3 `ComponentSeedsResourceTest`: контрольная сумма и счётчики

## 3. Документация

- [x] 3.1 Скилл `add-component`: переписать под текущий процесс, убрать устаревшее, добавить шаг сидов
- [x] 3.2 `js/cli/README.md`: команда `seeds:update`

## 4. Проверки

- [x] 4.1 `npm run typecheck` и `npm test` в `js/cli`
- [x] 4.2 Тесты ресурса сидов ds-service (`ComponentSeedsResourceTest`, `SeedResourcesContractTest`)
- [x] 4.3 [внешняя проверка] Новая дизайн-система на локальном стенде с пересобранным ds-service получает все компоненты сидов, включая новые
- [x] 4.4 `openspec validate add-component-seeds-writer --strict`
