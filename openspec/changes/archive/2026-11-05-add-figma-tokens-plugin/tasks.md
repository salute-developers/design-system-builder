## 1. Вход на стороне DS Builder

- [x] 1.1 Keycloak: клиент `dsbuilder-figma-plugin` в `dsbuilder-realm.json` и `bootstrap-production-keycloak.sh`: публичный, Device Authorization Grant включён, Authorization Code и пароль выключены, audience `dsbuilder-api`, тема `dsbuilder`
- [x] 1.2 Gateway: настройка `OIDC_PLUGIN_ORIGINS` в `GatewayConfiguration` и `docker-compose.prod.yml`; правило CORS по методу и пути отдельной функцией
- [x] 1.3 Тесты gateway: чтение и preflight с `Origin: null`, отказ для записи, настройка не задана, `401` без токена, нет `Access-Control-Allow-Credentials`
- [x] 1.4 OpenAPI `public-authentication.yaml`: endpoint устройства и grant `device_code`; публикация endpoint устройства в API Reference (`exactPaths`) и контрактные проверки `api-reference`
- [x] 1.5 Офлайн-сессия: `offline_access` в запросе плагина, роль `offline_access` в составе `user` в realm и production bootstrap, ошибка `not_allowed` в окне входа

## 2. Каркас плагина

- [x] 2.1 `js/apps/figma-plugin`: `package.json`, TypeScript, `vitest`, ESLint; манифест с `networkAccess`, `documentAccess: dynamic-page`, `themeColors`
- [x] 2.2 Сборка: окно в один HTML через `vite-plugin-singlefile`, основной поток в `dist/code.js`, адрес gateway по режиму сборки
- [x] 2.3 Подключить сборку и тесты к `js/package.json` (`verify:fast`) и `.github/workflows/validate-js.yml`
- [x] 2.4 Типизированный обмен сообщениями и основной поток: `clientStorage`, `openExternal`; тесты с подменой `figma`

## 3. Вход в плагине

- [x] 3.1 Запрос кода устройства и опрос: `authorization_pending`, `slow_down`, `expired_token`, `access_denied`, отмена; тесты с поддельным временем
- [x] 3.2 Сессия: восстановление, одно обновление на всех, `invalid_grant` и сетевая ошибка, выход; тесты
- [x] 3.3 HTTP-клиент: `401` → обновление → один повтор; тесты
- [x] 3.4 Экран входа: кнопка, `user_code`, «Открыть снова», отмена, ошибки; тесты экрана

## 4. Чтение и просмотр токенов

- [x] 4.1 Клиент API: проекты, дизайн-системы, версии, темы; типы ответов
- [x] 4.2 `TokenSnapshot`: чтение на границе версии и разбор цвета, градиента, типографики, размеров, теней, нераспознанное значение; тесты на значениях из фикстур
- [x] 4.3 Выбор контекста: шаги, пропуск единственного варианта, хлебные крошки, запоминание, недоступный контекст, пустой список; тесты
- [x] 4.4 Выбор версии: черновик и опубликованные, значение по умолчанию, пометка черновика; тесты
- [x] 4.5 Разделы «Цвета», «Типографика», «Размеры», режим Light и Dark, экран типографики, поиск; тесты
- [x] 4.6 Состояния загрузки, ошибки, `403`, отмена устаревшего чтения; тесты
- [x] 4.7 README приложения: сборка, импорт манифеста, локальный запуск, публикация

## 5. Проверка

- [x] 5.1 `tools/verify fast --change add-figma-tokens-plugin` и `tools/verify full --change add-figma-tokens-plugin`
- [x] 5.1.1 С явного разрешения разработчика обновить `.verification/strictacode-baseline` для `javascript-client`, `javascript-cli` и `frontend`: dev разошёлся с ними без этого изменения (код этих контуров здесь не менялся, кроме контрактного теста `OAuthConfigurationTest`)
- [x] 5.2 [внешняя проверка] Локальный контур: Keycloak выдаёт токен клиенту `dsbuilder-figma-plugin` через device flow, gateway принимает его на `GET /api/projects`, пароль и Authorization Code отклоняются
- [x] 5.2.1 [внешняя проверка] Keycloak 26.6.1, чистый импорт и существующий realm: refresh token типа `Offline`, после `/auth/logout` обновление завершается `invalid_grant`
- [x] 5.3 [внешняя проверка] Figma desktop, импорт манифеста, локальный gateway: вход через браузер, повторный запуск без входа, выход; разработчик подтверждает снимками экрана
- [x] 5.4 [внешняя проверка] Figma desktop: выбор контекста и версии, значения цвета, типографики и размеров совпадают с экранами DS Builder на той же теме; светлая и тёмная тема Figma
- [x] 5.5 [внешняя проверка] Страницы подтверждения устройства Keycloak выглядят приемлемо в теме `dsbuilder` или зафиксировано отдельное улучшение
