# Плагин DS Builder для Figma и Pixso

Приватный плагин организации: вход в DS Builder и просмотр токенов темы. Запись в файл редактора — следующий этап,
см. `openspec/changes/archive/2026-11-05-add-figma-tokens-plugin`.

## Устройство

- `src/main` — основной поток: `clientStorage` редактора и внешний браузер. Об API и OAuth не знает. `code.ts` и
  `pixso.ts` только передают в `startPlugin` глобальный объект своего редактора.
- `src/ui` — окно плагина на React: экраны и связь с общими Kotlin-модулями.
- `frontend-kt/plugins/figma-core` — вход, сессия и запросы к API на Kotlin/JS. Сборка плагина собирает его сама, поэтому нужен JDK 17.
- `src/shared` — протокол сообщений между ними.

Запросы к API идут из окна. Его origin — `null`, поэтому gateway нужна настройка `OIDC_PLUGIN_ORIGINS=null`.

## Запуск

```bash
npm install
npm run build:dev   # адрес gateway http://localhost:8080
```

В Figma desktop: Plugins → Development → Import plugin from manifest, выбрать `manifest.json`.

Локальному контуру нужны клиент `dsbuilder-figma-plugin` и роль `offline_access` в составе `user`: они создаются
импортом realm. Импорт не выполняется поверх существующей базы Keycloak, поэтому пересоздайте её.

## Запуск в Pixso

Сборка Pixso отличается только основным потоком и манифестом: окно и общие Kotlin-модули те же. В API Pixso нет
`openExternal`, поэтому адрес подтверждения входа открывает окно плагина.

```bash
npm run build:pixso:dev   # адрес gateway http://localhost:8080
npm run dev:pixso         # отдаёт dist-pixso отладчику на ws://localhost:5201/plugin
```

В Pixso откройте панель плагинов рядом с кнопкой Share и нажмите значок отладки слева в её заголовке. Сервер перечитывает
`dist-pixso` при каждом подключении, поэтому после новой сборки достаточно подключиться заново.

## Проверки

```bash
npm test
npm run build       # адрес боевого gateway
npm run build:pixso # то же и каталог dist-pixso
```

## Публикация

Приватная публикация выполняется в организации Figma. Figma выдаёт `id` плагина: запишите его в `manifest.json`
вместо значения для разработки.
