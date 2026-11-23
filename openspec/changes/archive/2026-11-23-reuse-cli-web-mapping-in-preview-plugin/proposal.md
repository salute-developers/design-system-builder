## Why

Правила, по которым свойство компонента ложится на параметры ядра `@salutejs/plasma-new-hope`, реализованы дважды: внутри генератора `js/cli` (классы значений `componentBuilder/props/*`, `component-source.ts`, `generate-api-meta.ts`) и в web-плагине превью `js/apps/preview-web-plugin` (`src/resolve/*`). Плагин держит свои копии данных: `web-adapter.json` (побайтно равен копии CLI, это проверяет тест), `public/api-meta.json` (626 КБ, CLI строит из того же ядра точно такой же файл) и `compose`-пары. Каждый новый компонент и каждая версия ядра требуют синхронно править обе стороны. Архивный change `bundle-web-adapter-in-cli` оставил это как отдельную задачу.

## What Changes

- В `js/cli` общие правила генератора выносятся в независимые функции без Node.js, без ядра и без знания о потребителях. Модуль называется `web-mapping`, а функции такие:
  - API-мета: типы, базовые параметры свойства, суффиксы ключей состояний.
  - Web-адаптер: данные `web-adapter.json`, подстановка `$1…$n`, имена компонентов, `compose`-связи.
  - Единицы: px → `rem` по базе 16, радиус с поправкой.
  - Типографика: поле типографики параметра ядра, основа имени переменных типографики темы.
  - Ядро: имя объекта токенов и базового конфига компонента по манифесту генератора.
  - Переменные темы: имя переменной цвета, суффиксы производных токенов состояний.

  В модуль попадает только то, что вызывает сам генератор. Эвристики превью (выбор параметра состояния по мете, шаблон по всем конфигурациям) остаются в плагине.

  Генератор сам переходит на эти функции, сгенерированный код не меняется.
- Пакет `@sddsjs/design-system-builder-generator` публикует модуль точкой входа `./web-mapping`, построение API-меты — подкомандой `dsbuilder-web-generator api-meta --out <файл>` (сейчас это только скрипт репозитория `generate:api-meta`), а манифесты компонентов генератора — подкомандой `dsbuilder-web-generator manifests --out <файл>`.
- Web-плагин зависит от пакета генератора точной версией. Разбор payload, тема, предупреждения и отрисовка остаются в плагине, но собираются из функций `web-mapping`. **BREAKING** для разработки плагина: удаляются его `src/data/web-adapter.json`, закоммиченный `public/api-meta.json` и собственные реализации меты, шаблонов, единиц и типографических полей. Мета строится подкомандой CLI перед `dev`, `build` и `test`.
- Плагин перестаёт держать ручные таблицы объектов ядра (`coreTokensByComponent`, `coreConfigNameByComponent`): имена берутся по манифестам генератора теми же функциями, что у генератора.
- Исправляются имена переменных типографики `header` и `display`. Правильные имена — как в plasma и у генератора тем (`--plasma-typo-h3-bold-*`, `--plasma-typo-dspl-l-*`). Импортёр `import:plasma` сейчас пишет несуществующие `--plasma-typo-header-h3-bold-*` и `--plasma-typo-display-l-bold-*`, плагин объявляет такие же. Эти ссылки попали в `component-seeds.json` у Heading, Calendar, CalendarDouble, DatePicker, DateTimePicker (`header-hN`) и Dspl (`display-*`) и не работают в собранном пакете. Импортёр и плагин переходят на правило генератора, сиды исправляются. Существующие ДС на стендах исправляет Flyway-миграция в ds-service.
- `apiMetaSha256` уходит из закоммиченного `public/preview-plugin.json`, его пишет упаковка. Формат архива и проверки `ds-service` не меняются.
- Тест побайтного равенства двух копий `web-adapter.json` удаляется вместе с копией плагина.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `web-generator-package`: пакет публикует независимые функции `web-mapping` и подкоманды `api-meta` и `manifests`.
- `web-preview-plugin`: реестр плагина находит объекты ядра по манифестам генератора вместо таблиц `coreTokensByComponent`/`coreConfigNameByComponent`; плагин берёт данные и общие правила маппинга из пакета генератора, а не из своих копий; имена переменных типографики темы — по правилу генератора.
- `component-preview-composition`: объект токенов ядра компонента для превью находится по манифестам генератора, ручной карты соответствий нет.
- `local-web-generation`: `web-adapter.json` остаётся только в `js/cli`, требование о совпадении с копией плагина снимается.

## Impact

- `js/cli`:
  - новый каталог `src/web-mapping/`;
  - генератор переводится на него: `componentBuilder/props/*`, `themeBuilder/creators/create{Color,Gradient,ViewContainer}Tokens.ts`, `component-source.ts`, `components-input.ts`, `generate-api-meta.ts`, `import-plasma-component.ts`;
  - `exports` и рекурсивный скрипт `test` в `package.json`, подкоманда `api-meta` в `bin`;
  - подкоманда `manifests`;
  - подъём `version` и ручная публикация до перевода плагина.
- `backend-kt/ds-service`: `feature-components/src/main/resources/component-seeds.json` — замена `--plasma-typo-header-hN-` на `--plasma-typo-hN-` и `--plasma-typo-display-` на `--plasma-typo-dspl-` у шести компонентов, обновление sha256 в `ComponentSeedsResourceTest`; Flyway-миграция `V23__fix_typography_variable_names.sql` исправляет существующие значения во всех редакциях (черновики и опубликованные версии), прежние значения — в `v23_typography_backup`. Копия правила имён в `feature-themes` (`TypographyStyleNaming`) уже совпадает с генератором и не меняется.
- `js/apps/preview-web-plugin`:
  - зависимость от пакета генератора;
  - удаление копий данных и дублирующих функций в `src/resolve/`;
  - шаги `predev`/`prebuild`/`pretest`, `.gitignore` для меты;
  - правка `scripts/package.mjs` и тестов, подъём `version`.
- Документация, где сказано про две копии `web-adapter.json` и ручную пересборку `api-meta.json`: `js/cli/src/import-plasma-component.ts`, `js/CLAUDE.md`, `js/cli/README.md`, `backend-kt/preview/contract/README.md`, `.claude/skills/add-component/SKILL.md`.
- `frontend-kt`, формат архива плагина и протокол превью не меняются.
