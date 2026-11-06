# Figma-плагин DS Builder

Приватный плагин организации: вход в DS Builder и просмотр токенов темы. Запись в файл Figma — следующий этап,
см. `openspec/changes/add-figma-tokens-plugin`.

## Устройство

- `src/main` — основной поток Figma: `figma.clientStorage` и внешний браузер. Об API и OAuth не знает.
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

## Проверки

```bash
npm test
npm run build       # адрес боевого gateway
```

## Публикация

Приватная публикация выполняется в организации Figma. Figma выдаёт `id` плагина: запишите его в `manifest.json`
вместо значения для разработки.
