## Why

Пакет, который генерирует DS Builder для web, должен повторять экспорт `sdds-serv`, но три его части генератор сейчас собрать не может: `SSRProvider` (в sdds-serv — прямой реэкспорт ядра, а в ДС его не завести: имя `ssr-provider` не восстанавливается в `SSRProvider`), `ViewContainer` (его вид `onDark`/`onLight` подставляет наборы переменных темы `viewContainer`, которых нет в пакете без темы) и второй appearance у компонента с дженерик-обёрткой (`Select` с `clear`: значения в базе есть, а обёртка собирается только из конфига `default`).

## What Changes

- Корневой `src/index.ts` пакета с компонентами реэкспортирует из `@salutejs/plasma-new-hope/styled-components` компоненты ядра, которые в sdds-serv не имеют конфига темы и не заводятся в ДС; список ведётся в генераторе, первый элемент — `SSRProvider`.
- Манифест генератора получает признак `requiresTheme`: обёртка такого компонента берёт данные из темы пакета. Компонент с признаком генерируется только в пакет, где есть тема (`generate:ds`, или `generate:components` без `--package` при существующей `src/theme`); иначе генератор пропускает его с предупреждением.
- `ViewContainer` заводится в базовую ДС пустым компонентом; шаблон обёртки строит вариацию `view` (`onDark`, `onLight`) из `viewContainer` темы пакета, как sdds-serv из `sdds-themes`. Web-плагин превью получает story ViewContainer, где вид — аргумент story.
- Дженерик-обёртка при нескольких appearance собирает компонент на каждый appearance, выбирает его через `createConditionalComponent` и добавляет в тип пропсов `appearance`, как обёртка `Select` в sdds-serv.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `generator-component-manifest`: порядок выбора обёртки — дженерик с несколькими appearance; признак `requiresTheme`.
- `local-web-generation`: корневой индекс реэкспортирует компоненты ядра без конфига темы; пропуск компонента, которому нужна тема, в пакете без темы.

## Impact

- **js**: `js/cli/src/package-output.ts` (корневой индекс), `js/cli/src/generator/generate.ts` и `creators/createComponent.ts` (дженерик с appearance, `requiresTheme`), `js/cli/src/generator/types/index.ts`, шаблон `js/cli/src/generator/templates/ViewContainer/`, тесты `js/cli`; `js/apps/preview-web-plugin` — story ViewContainer, реестр и манифест; `js/apps/client/src/utils/menuItems.ts` — ViewContainer в меню; обе копии `web-adapter.json` — запись ViewContainer.
- **backend-kt**: без изменений кода; данные локальной базовой ДС — компонент ViewContainer.
- **frontend-kt**: без изменений.
- Документация: скилл `add-component` и `js/cli/README.md`.
