## 1. Пакет в plasma

- [x] 1.1 Скопировать `js/apps/preview-web-plugin` (без `node_modules`, `dist`, `package-lock.json`, сгенерированных `public/api-meta.json` и `src/generated/`) в `~/Documents/work/plasma/packages/sdds-preview-web-plugin`
- [x] 1.2 `package.json`: имя `@salutejs/sdds-preview-web-plugin`, `"private": true`, `author`, ядро/b2c/icons — точными версиями workspace, `@sddsjs/design-system-builder-generator` `0.2.0` (решения 1–2); `.gitignore` для `archive/`
- [x] 1.2a `resolve.dedupe` для `react`, `react-dom`, `styled-components` в `vite.config.ts` и `vitest.config.ts`; путь к ядру в тестах через `createRequire`
- [x] 1.3 `scripts/package.mjs`: архив `archive/preview-web-plugin.zip`, проверка чистоты пакета и ядра/b2c/icons, `plasmaNewHopeVersion` при упаковке (поле убрать из `public/preview-plugin.json`), печать блока происхождения вместо правки `local-dev/README.md` (решение 3); `test/package.test.ts`, `test/manifest.test.ts`, `scripts/package.d.mts`
- [x] 1.4 Тесты без DS Builder: удалить `readContractWebButtonFixture` и его тест, сверку с `CLIENT_COMPONENT_MAPPER` (решение 4)
- [x] 1.5 Комментарии со ссылками на пути DS Builder (`js/apps/client/...`, `backend-kt/...`, шапки «Копия `js/apps/client/src/stories/...`» в `src/stories`) переформулировать без путей
- [x] 1.5a Линтер plasma: `npx eslint packages/sdds-preview-web-plugin --fix` из корня, остальное вручную (решение 6)
- [x] 1.6 README пакета: назначение, подготовка (`npx lerna run prepare --scope @salutejs/sdds-preview-web-plugin --include-dependencies`), команды, упаковка и доставка архива в DS Builder
- [x] 1.6a Ручная проверка (сборка `6b4c1f0578fc` на локальном стенде, проверено пользователем): архив пакета опубликован в локальный стенд, превью нескольких компонентов рисуется
- [x] 1.7 Установка из корня plasma (`npm install` без лишних изменений lock-файла), сборка ядра, `npm test`, `npm run build`, `npm run lint` пакета; `node scripts/lint-packages.js`

## 2. DS Builder

- [x] 2.1 Удалить `js/apps/preview-web-plugin`
- [x] 2.2 `AGENTS.md`, `js/CLAUDE.md`, `.claude/skills/add-component/SKILL.md`: плагин и story — в plasma `packages/sdds-preview-web-plugin`; правило версий только для `js/cli`
- [x] 2.3 `setup-local.sh`, `publish-preview-plugin.sh`, `js/docker-compose.dev.yml`, `local-dev/README.md`, `js/apps/client/README.md`, `backend-kt/preview/contract/README.md`: ссылки и инструкции на пакет в plasma
- [x] 2.4 `grep -rn preview-web-plugin` по репозиторию (кроме имени архива `preview-web-plugin.zip` и `openspec/changes/archive`): ссылок на каталог плагина не осталось; `cd js && npm run build`, `npm run test:cli`
- [x] 2.5 Память: путь плагина, правило версий
