## Why

Публикации npm-пакета из DS Builder больше нет, но клиент по-прежнему показывает её статус. Страница
настроек дизайн-системы, пока открыта, раз в 15 секунд опрашивает `registry.npmjs.org` и выводит блок
«Публикация в npm» с версией и ссылкой. Ещё есть страница «Обзор» с командой `npm install` и тем же
опросом, но она нигде не рендерится. Это лишние внешние запросы и устаревшая информация в интерфейсе.

## What Changes

- Из настроек дизайн-системы удаляется блок «Публикация в npm» вместе с опросом npm registry.
- Удаляются хук `useNpmLatestVersion`, npm-хелперы `api/getNpmMeta.ts`, компонент `InstallCommand` и
  нерендерящаяся страница `pages/overview`.
- Редирект маршрута темы `overview → colors` остаётся: на `/overview` ведут ссылки из карточки темы,
  её настроек и создания темы.
- Переменная `VITE_NPM_PACKAGE_SCOPE` больше не используется клиентом и удаляется из deploy workflow
  клиента.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `web-design-system-publication`: добавляется требование, что веб-клиент не обращается к npm registry и
  не показывает статус публикации npm-пакета.

## Impact

- **js**: `apps/client` — `pages/designSystems/DesignSystemSettingsPage.tsx`, `styles/workflow.css`,
  удаление `hooks/useNpmLatestVersion.ts`, `api/getNpmMeta.ts`, `components/InstallCommand`,
  `pages/overview`, экспорты из `hooks`, `api`, `components`, `pages`.
- **Корень репозитория**: `.github/workflows/deploy-front-apps-dev.yml` и `deploy-front-apps-prom.yml`
  (переменная `VITE_NPM_PACKAGE_SCOPE`); GitHub Variables `VITE_NPM_PACKAGE_SCOPE_DEV`/`_PROM` можно
  удалить вручную.
- **backend-kt**, **frontend-kt**: изменений нет.
