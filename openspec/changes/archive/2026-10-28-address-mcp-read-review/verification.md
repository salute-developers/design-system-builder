# Проверка на локальных данных

В `VersionedReadHttpPostgresIntegrationTest` после загрузки `ComponentSeedFixture` измерены сериализованные JSON-тела ответов без HTTP-заголовков: список стилей компонента — 2 981 байт, дерево цветовых групп — 3 642 байта, палитра арендатора — 198 724 байта. Это размеры конкретной тестовой дизайн-системы, не верхние границы контракта MCP. В исходном каталоге 63 компонента; отдельный объект компонента занимает от нескольких килобайт до 58 667 байт (`Select`).

Уже на фикстуре полная палитра достигает около 194 КиБ. Прозрачное сокращение ответа потребовало бы отдельного режима краткого чтения или постраничного контракта с продолжением. В этом change полные ответы остаются полными; вопрос ограничения больших ответов следует решать отдельным изменением после измерения реальных дизайн-систем и страниц документации.

Замер воспроизводится интеграционным тестом с временным выводом длины UTF-8 JSON для `allStyles`, `groups` и `palette`; сам вывод удалён из теста после замера.

## Проверки

- `DOCKER_HOST=unix:///Users/aamalyshev/.docker/run/docker.sock JAVA_TOOL_OPTIONS=-Dapi.version=1.44 tools/verify fast --change address-mcp-read-review` — exit 0; backend, frontend и JS прошли.
- Независимое повторное read-only review после устранения полной загрузки групп — блокирующих замечаний нет. Дополнительный PostgreSQL-сценарий для одинаковых позиций и опубликованной версии отмечен как неблокирующее улучшение покрытия.
- `tools/verify full --change address-mcp-read-review` — backend `verifyFull` и Strictacode прошли; frontend `verifyFull` прошёл, затем Strictacode остановил общий скрипт: `overengineering_pressure 2 > 1`. Baseline не изменялся. По ранее согласованному исключению Strictacode пока игнорируется.
- `cd js && npm run verify:full` — exit 0 после запуска с доступом к локальному IPC-сокету. Отдельный Strictacode JS показывает прежнее превышение `complexity_density 0.02 > 0.0`; этот результат также входит в согласованное исключение.

## Внешняя проверка

- `DOCKER_HOST=unix:///Users/aamalyshev/.docker/run/docker.sock JAVA_TOOL_OPTIONS=-Dapi.version=1.44 ./gradlew :ds-service:app:test --tests 'com.dsbuilder.ds.app.VersionedReadHttpPostgresIntegrationTest'` — exit 0. Работающий Ktor/PostgreSQL API вернул дерево цветовых групп в порядке `Text & Icons → Accent → Status → General → Surfaces → … → BG → Default → Overlays → Default → Data → Default`; объединение страниц `limit=1` в тесте точно равно полному ответу. Временный вывод порядка удалён после замера.
- `./gradlew :cli:jvmTest --tests 'com.dsbuilder.frontend.cli.McpCliLauncherContractTest'` — exit 0; SDK CLI subprocess возвращает 27 инструментов и обязательные поля в `tools/list`.
- `./gradlew :mcp-node:packageMcpNodeNpm`, затем `node frontend-kt/mcp-node/build/npm-package/bin/dsbuilder-mcp.js serve` с JSON-RPC `initialize` и `tools/list` — exit 0, 27 инструментов. В пересобранном Node-пакете `component_configurations_list` требует `componentId`, `component_config_get` — `appearanceId`, `code_binding_get` — `bindingId`, `documentation_get_page` — `path`.

## Архивирование

`openspec archive -y address-mcp-read-review` синхронизировал три требования с основными спецификациями и перенёс change в архив. Обе затронутые спецификации проходят адресную строгую проверку. Общая `openspec validate --specs --strict --no-interactive` возвращает exit 1 из-за уже существующего предупреждения о длине требования в `local-web-generation` (82 спецификации прошли, одна нет); эта спецификация не менялась в данном исправлении.
