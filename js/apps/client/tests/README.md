# Product UI E2E

Один пилот: обычный Owner создаёт дизайн-систему через UI, проверяет независимый GET,
полный reload и повторное открытие, затем удаляет только свою систему через API.
Браузерные запросы выполняются без подмены ответов/CORS.

## Первый запуск

Нужны Node.js 22.16.0+, готовые Client/Gateway/Keycloak и обычная тестовая учётная
запись без system_admin, которой разрешено создавать проекты. Тест не запускает
Docker, миграции, seed и не создаёт пользователя.

Из js/apps/client установите зависимости и Chromium один раз:

```sh
npm ci
npm run test:e2e:install-browser
```

Скопируйте e2e.env.example в **.env.e2e.local рядом с package.json**:

```sh
# macOS
cp -n e2e.env.example .env.e2e.local
chmod 600 .env.e2e.local
```

```powershell
# Windows
if (!(Test-Path .env.e2e.local)) { Copy-Item e2e.env.example .env.e2e.local }
```

В .env.e2e.local заполните DSB_E2E_USERNAME и DSB_E2E_PASSWORD. Пример содержит
DSB_E2E_ALLOW_MUTATIONS=true. Адреса подставляются автоматически: Client —
http://localhost:3002/, Gateway — http://localhost:8080/, clientId — dsbuilder-api.
Для другого стенда задайте адреса/clientId в файле; remote требует HTTPS, loopback допускает HTTP.
Используйте только тестовую учётную запись и согласованный тестовый стенд.

Затем на обеих ОС достаточно:

```sh
npm run test:e2e
```

Не нужны export, путь к credentials или ручной projectId. Локальный файл читается
относительно исходников независимо от cwd. .env.e2e.local исключён из Git;
публичный e2e.env.example содержит только пустые логин/пароль. Токены между запусками
не сохраняются. Дополнительные локальные копии с секретами держите вне Git.

Env имеет приоритет над файлом. Можно явно задать DSB_E2E_CREDENTIALS_FILE для другого
профиля: тогда он читается вместо стандартного .env.e2e.local. Файл разбирается через
parseEnv без source/eval. Обязательны username/password и DSB_E2E_ALLOW_MUTATIONS=true.
Отсутствующие или пустые адреса/clientId используют локальные значения по умолчанию.
Старый DSB_E2E_PROJECT_ID больше не используется.

## Проект и очистка

Helper ищет собственный active-проект E2E Automation с ролью Owner. Если его нет —
создаёт через публичный API; если есть — переиспользует. Защищённый GET подтверждает
владельца и права до UI. Проект сохраняется между запусками, не удаляется и не архивируется.
Чужие и архивные проекты не используются. При нескольких собственных совпадениях тест
останавливается; устраните дубликаты либо задайте другое DSB_E2E_PROJECT_NAME.

Один проект используется последовательно, включая запуски с разных машин.
У каждой системы уникальное имя; ID ответа 201 регистрируется до последующих assertions.
Cleanup в finally подтверждает Owner, свежий объект и baseline, делает одну попытку DELETE,
затем GET 404 и сверку исходных систем. Очистка вызывается только из finally fixture, ровно один раз.
Проект и исходные системы сохраняются; POST/DELETE автоматически не повторяются.

После убийства процесса finally не гарантирован. Разбирайте известный ID вручную в нужном
проекте; имя само по себе не разрешает удаление. Потерянный ответ создания проекта
не вызывает повторный POST в текущем запуске; следующий запуск может найти свой проект
через API. Постоянного журнала/lock/recovery нет.

## Команды и структура

| Команда | Назначение |
|---|---|
| npm run test:e2e | Chromium без окна, один worker, retries=0. |
| npm run test:e2e:headed | Тот же автоматический поток с окном. |
| npm run test:e2e:debug | Штатный Playwright Inspector. |
| npm run test:e2e -- --list | Список без credentials, браузера, сети и подготовки проекта. |
| npm run test:e2e:check | Strict TypeScript и список Product-тестов. |
| npm test | Существующие Vitest/компонентные тесты. |
| npm run test:browser-smoke | Отдельный Compose smoke с прежним plugin artifact. |

config — Environment/Credentials; pages — локаторы и действия страницы; steps —
составные UI-действия через test.step; helpers — сессия, проект и технические API;
fixtures/test.ts — зависимости/baseline/finally; e2e — сценарий/assertions.
Новые страницы/Steps добавляются по реальной потребности. BasePage, пустых модулей
и отдельного E2E infrastructure unit-набора нет.

## Диагностика

Предусловия, assertions и cleanup дают ненулевой exit при ошибке. Нативный отчёт сохраняет
исходную ошибку и ошибки teardown. Annotations e2e-project и created-design-system содержат ID.
Отчёты: playwright-report/product/, test-results/product-report.json; ошибочные screenshot/trace —
test-results/product/. Они исключены из Git. Сохраните отчёт до последующего --list.

```sh
npx playwright show-report playwright-report/product
```

Технические запросы выполняются встроенным Node fetch без повторов/redirect, с таймаутами
и безопасными ошибками. Это исключает запись Authorization и OAuth form в автоматические
API-шаги Playwright. Проверки авторизации передают в assertions только типы/признаки.

Trace может содержать сессию и заголовки: это закрытый локальный материал, который
автоматически не публикуется. Не печатайте credentials, token responses или storageState.
