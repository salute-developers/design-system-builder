## Why

Web-плагин превью рисует компоненты `@salutejs/plasma-new-hope` и живёт рядом с ними по смыслу: его story — копии story вертикалей, его версия ядра должна совпадать с ядром, а новые компоненты появляются сначала в plasma. Пока плагин лежит в `js/apps/preview-web-plugin` DS Builder, каждый новый компонент ядра требует правок в двух репозиториях. После change `reuse-cli-web-mapping-in-preview-plugin` плагин зависит от DS Builder только через npm-пакет генератора, поэтому его можно перенести в монорепозиторий plasma.

## What Changes

- В plasma появляется пакет `packages/sdds-preview-web-plugin` (`@salutejs/sdds-preview-web-plugin`, `"private": true`): исходники, story, тесты и упаковка плагина переносятся без изменения поведения. Ядро, `plasma-b2c` и `plasma-icons` подключаются из workspace точными версиями, как у вертикалей (`plasma-b2c`/`plasma-icons` при этом обновляются до версий в plasma); React и `styled-components` — свои, без дублей в бандле; общие правила маппинга — из `@sddsjs/design-system-builder-generator@0.2.0`. Пакет проходит линтер и `lint:packages` plasma.
- Упаковка (`npm run package`) пишет архив в каталог пакета и печатает блок происхождения; файлы DS Builder она больше не трогает. `commit` в манифесте — коммит plasma; `plasmaNewHopeVersion` дописывается при упаковке из установленного ядра.
- Тесты плагина перестают читать файлы DS Builder: тест разбора фикстуры из `backend-kt/preview/contract` и сверка реестра со списком `componentMapper` клиента удаляются, без копий контракта.
- **BREAKING** для разработки в DS Builder: каталог `js/apps/preview-web-plugin` удаляется. `local-dev/web-preview/preview-web-plugin.zip` остаётся источником плагина для локального стенда; новый архив собирается в plasma и копируется в `local-dev`.
- Ссылки на путь плагина в DS Builder (`AGENTS.md`, `js/CLAUDE.md`, скилл `add-component`, `setup-local.sh`, `publish-preview-plugin.sh`, `js/docker-compose.dev.yml`, `local-dev/README.md`, `js/apps/client/README.md`, `backend-kt/preview/contract/README.md`) указывают на пакет в plasma.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `web-preview-plugin`: плагин — пакет `packages/sdds-preview-web-plugin` репозитория plasma; реестр не сверяется с клиентом DS Builder; dev-сервер — пакета в plasma.
- `local-web-preview-plugin`: архив собирается в plasma и копируется в `local-dev/web-preview/` DS Builder вручную вместе с блоком происхождения.

## Impact

- **plasma**: новый пакет `packages/sdds-preview-web-plugin`, запись в корневом `package-lock.json` (workspace); без коммитов и без подъёма версий вручную.
- **js**: удаление `js/apps/preview-web-plugin`; правки `js/CLAUDE.md`, `js/apps/client/README.md`, комментария в `js/docker-compose.dev.yml`.
- **Корень и local-dev**: `AGENTS.md` (правило версий только для `js/cli`), `setup-local.sh`, `publish-preview-plugin.sh`, `local-dev/README.md`, `.claude/skills/add-component/SKILL.md` (story — в plasma).
- **backend-kt**: только `preview/contract/README.md`. **backend-kt, frontend-kt**: код не меняется; формат архива, протокол превью и публикация `dsbuilder preview-plugin publish --platform react` те же.
