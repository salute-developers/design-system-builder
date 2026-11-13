# Результаты проверки

Дата: 2026-10-26. Ветка: `feature/use-pkce-for-cli-mcp`, база: `feature/mcp-tools-read`.

Контур: локальные PostgreSQL, Gateway и Keycloak 26.6.1; Node 26.12.0; Xcode 27.1.
Проверены Mach-O executable arm64 и x86_64, JVM-дистрибутив и установленный npm tarball.
Все нижеуказанные завершённые проверки имеют exit code 0, если отдельно не указан ожидаемый отказ.
Токены, пароли, коды OAuth и значения project keys в этом отчёте не сохраняются.

## Автоматические проверки

- `DOCKER_HOST=unix:///Users/aamalyshev/.docker/run/docker.sock JAVA_TOOL_OPTIONS=-Dapi.version=1.44 tools/verify fast --change use-pkce-for-cli-mcp` — PASS, включая нативные тесты обеих архитектур.
- Независимое read-only review реализации, последующих исправлений Strictacode, темы и страницы callback — без блокирующих замечаний.
- `DOCKER_HOST=unix:///Users/aamalyshev/.docker/run/docker.sock JAVA_TOOL_OPTIONS=-Dapi.version=1.44 PATH=/private/tmp/pkce-strictacode-runtime/bin:$PATH tools/verify full --change use-pkce-for-cli-mcp` — PASS; backend/frontend build, статический анализ, тесты и оба Strictacode compare.
- `cd frontend-kt && ./gradlew compileSharedMcpDependencyGraph` — PASS.
- `:mcp-node:npmPackMcpNodeSmoke` — упаковка, установка во временный каталог вне Gradle, запуск executable и stdio-проверки PASS.
- Baseline и защищённые правила не менялись.

## 4.1 — общий вход, токены и совместимость

Реальный браузерный вход через JVM CLI и установленный Node executable завершился с exit code 0.
JVM-вход и появление страницы результата подтверждены разработчиком; Node-вход дополнительно выполнен через управляемый браузер.

Для оставшейся матрицы использован временный локальный HTTP-прокси к настоящему Gateway/Keycloak.
Прокси сохранял реальный Host/issuer и проксировал форму с cookies; отдельный loopback API URL
давал отдельный файл сессии без подмены HOME и без изменения основной CLI-сессии.
Тестовый пользователь и временные проект/дизайн-система созданы через публичные API.

Проверено:

- одна файловая сессия читается JVM и Node;
- schemaVersion 2 и ровно семь разрешённых полей, clientId `dsbuilder-studio-plugin`;
- каталог 0700, файл 0600;
- access token фактического PKCE-обмена имеет audience `dsbuilder-api` и azp `dsbuilder-studio-plugin`;
- username получен через настоящий userinfo;
- реальный refresh проходит и ротирует refresh token;
- `auth logout` установленного Node executable возвращает exit code 0 и удаляет файл;
- последующий обмен отозванного refresh token в Keycloak даёт HTTP 400;
- существующие процессы MCP после logout возвращают `AUTH_REQUIRED`.

Web: прежние password grant и refresh клиента `dsbuilder-api` дали HTTP 200;
в предыдущем браузерном прогоне проверены страница клиента, переход к проектам и выход.

IDE: отдельный JVM-стенд использовал production `OAuthLoginUseCase`, `RefreshUserSessionUseCase`,
`KtorTokenExchangeClient`, `UserSessionCredentialResolver` и настоящий `JvmRedirectListenerFactory`
с реальным браузером и Keycloak. Вход, refresh, userinfo и отзыв тестовой сессии прошли.
Отдельный `RefreshTokenStore` стенда не изменил CLI-файл побайтно; его очистка также не затронула CLI.
Граница проверки: GUI IDE и системный PasswordSafe не запускались. Конкретный
`PasswordSafeRefreshTokenStore` не менялся, проверен по исходникам и собран в FULL;
внешняя проверка покрывает production прикладной сценарий, сеть, listener и независимость хранилищ.

## 4.2 — отрицательные сценарии

- Правильный authorization code с подменённым verifier отправлен настоящему Keycloak через прокси:
  установленный Node executable завершился с exit code 1, показал страницу отказа и не сохранил сессию.
  Положительный прогон с исходным verifier на том же контуре завершился успешно.
- Неверный state и точный несовпадающий callback path: HTTP 400, exit code 1,
  отсутствие файла сессии и освобождённый listener.
- Фактический Keycloak принял loopback redirect с портами 49153 и 57341: HTTP 200.
- Чужой redirect: HTTP 400. Отсутствующий challenge и `plain`: HTTP 302 с
  `error=invalid_request`, без code.
- Проверки настоящих native executable arm64/x64 подтвердили отказ, UTF-8 Content-Length,
  no-store/no-referrer, отсутствие отражения входных параметров и освобождение порта.

## 4.3 — платформы и два процесса

Реальный вход выполнен на JVM, macOS arm64, macOS x64 и установленном Node tarball: exit code 0.
Закрытие listener проверено реальными HTTP/port-проверками; native варианты дополнительно
проверены локальным тестовым провайдером и настоящим socket-ответом.

Одновременно запущены разные JVM и Node MCP-процессы с одним API URL и файлом сессии.
Оба получили доступ к временным проекту и дизайн-системе. Прокси наблюдал два настоящих refresh:
максимум один одновременно, второй запрос использовал результат первой ротации, итоговый файл
содержал результат второй. Повторное чтение каждым процессом не добавило refresh-запросов.
Это внешняя проверка файловой блокировки, перечитывания и кеша, а не подстановка ответов провайдера.

## 4.4 — MCP и project keys

Текущий доступный реестр содержит 16 tools; готовность другого реестра не требовалась.

- JVM и Node: initialize/tools/list работают без credentials и после logout.
- `project_get_status` без credentials и после logout: `AUTH_REQUIRED`.
- После входа тот же инструмент успешно читает настоящий проект и дизайн-систему.
- Project key со scopes `projects:read`, `design-systems:read`: успешное чтение.
- Project key только с `documentation:read`: `FORBIDDEN`, без пользовательского refresh/fallback.
- Отозванный project key: `PROJECT_KEY_INVALID`, без пользовательского refresh/fallback,
  несмотря на существующую пользовательскую сессию.
- Каждый stdio-ответ разбирается как JSON-RPC; завершение EOF даёт exit code 0.
  Вывод проверен на отсутствие фактических access/refresh tokens и значений ключей.
  Интерактивного входа из serve/tools не было; RPC завершаются без ожидания браузера.

## Доказательства и очистка

Команды внешних стендов:

```bash
python3 /private/tmp/pkce-remaining/provision.py
python3 /private/tmp/pkce-remaining/run.py
python3 /private/tmp/pkce-provider-check.py
javac -cp 'frontend-kt/cli/build/install/cli-jvm/lib/*' /private/tmp/pkce-remaining/IdeCompatibility.java
python3 /private/tmp/pkce-remaining/ide-run.py
python3 /private/tmp/pkce-native-callback-check.py
```

Итоговая матрица `run.py` — PASS. Отдельные отрицательные PKCE-сценарии сохранены в
`matrix-before-final.log`, фактические redirect/challenge проверки — в `provider-negative.log`,
IDE — в `ide-final.log`; общий итог — `results.json`. Файлы находятся в
`/private/tmp/pkce-remaining/`. Ранние прогоны исправляли только вспомогательный стенд:
URL/cookies прокси и ожидаемые контрактные HTTP 200/`PROJECT_KEY_INVALID`; production-код не менялся.

После проверки временные ключи отозваны, дизайн-системы удалены (HTTP 200), временные проекты
архивированы штатным API (HTTP 200), тестовые сессии отозваны, прокси и MCP-процессы остановлены.
Основной вход пользователя не заменялся тестовыми credentials.

## Проверка после архива

Основная спецификация синхронизирована: четыре изменённых и четыре новых требования.
`openspec validate frontend-client-authentication --type spec --strict --no-interactive` — PASS.
Прежний placeholder Purpose заменён описанием назначения. `git diff --check` — PASS.
Общий `openspec validate --specs --strict --no-interactive` не проходит из-за прежних
проблем остальных спецификаций (25 passed / 53 failed); основной checkout также
не проходит эту проверку (24 passed / 58 failed при 82 items).
