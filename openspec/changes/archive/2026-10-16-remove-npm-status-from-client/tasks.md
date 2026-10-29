## 1. Удаление

- [x] 1.1 Удалить блок «Публикация в npm» и вызов `useNpmLatestVersion` из `pages/designSystems/DesignSystemSettingsPage.tsx`, стили `.ds-publication-status` из `styles/workflow.css`
- [x] 1.2 Удалить `hooks/useNpmLatestVersion.ts`, `api/getNpmMeta.ts`, `components/InstallCommand`, `pages/overview` и их экспорты
- [x] 1.3 Удалить `VITE_NPM_PACKAGE_SCOPE` из `.github/workflows/deploy-front-apps-dev.yml` и `deploy-front-apps-prom.yml`

## 2. Тесты

- [x] 2.1 Тест настроек дизайн-системы: блока публикации в npm нет, запросов к npm registry нет
- [x] 2.2 Убедиться, что редирект `overview → colors` покрыт тестом или добавить его (добавлен `App.test.tsx` на настоящих маршрутах `App`)

## 3. Проверки

- [x] 3.1 `cd js && npm run build`, `npx vitest run` в `apps/client`, поиск ссылок на удалённое
- [x] 3.2 `openspec validate remove-npm-status-from-client --type change --strict --no-interactive`
