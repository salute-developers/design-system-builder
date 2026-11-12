## 1. Конфигурация

- [x] 1.1 В `.github/workflows/deploy-front-apps-prom.yml` задать `VITE_COMPONENT_EDITOR_ENABLED: 'true'`
- [x] 1.2 В `js/apps/client/README.md` описать, что DEV и PROM собираются с включённым флагом

## 2. Проверка

- [x] 2.1 Прогнать тесты флага клиента (`featureFlags.test.ts`, `ComponentsRoute.test.tsx`, `Main.test.tsx`) и `npm run build` клиента
- [x] 2.2 `openspec validate enable-component-editor-on-prom --strict`
