## 1. ds-service

- [x] 1.1 `AppearanceNaming.requireName` (kebab-case, длина) в `requireFree`, простых `POST /appearances` и `PATCH /appearances/{id}` → `422 appearance_name_invalid`
- [x] 1.2 Генерация имён: первая — kebab(имя компонента), новая — `new`, копия — `kebab(источник)-copy`, суффиксы `-2`, `-3`
- [x] 1.3 Импорт: запись с именем не по правилу — в `rejected` с причиной `appearance_name_invalid`
- [x] 1.4 OpenAPI; интеграционные тесты: переименование с пробелом, имена новой и копии, импорт, первая конфигурация

## 2. Клиент

- [x] 2.1 Поле имени конфигурации в «Структуре»: приведение к kebab-case при вводе, подсказка правила, сообщение `appearance_name_invalid`; тесты

## 3. Web-генератор

- [x] 3.1 `appearanceIdentifier` (kebab → camelCase), имена файлов, переменных и экспортов, ключ-строка; ошибка для имени не по правилу
- [x] 3.2 Тесты генератора: `default` + `clear-action` дают компилируемый код; имя с пробелом — ошибка

## 4. Проверка

- [x] 4.1 `./gradlew build` для `ds-service`, `npm test` и сборка клиента, тесты и typecheck `js/cli`
- [x] 4.2 В браузере: создание и копия получают kebab-имена, поле не пропускает пробел; генерация Base после переименования `Accordion new`
