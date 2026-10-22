# Задачи

## 1. Серверная конфигурация и общий сценарий

- [ ] 1.1 Проверить и при необходимости расширить существующий dsbuilder-studio-plugin без новой регистрации: S256, отсутствие secret/password grant, audience dsbuilder-api и переменный loopback-порт; конфигурационными тестами подтвердить сохранение web/IDE.
- [ ] 1.2 Проверить Gateway authorize/token/userinfo/logout и local/prod nginx, обновить актуальные OpenAPI и контрактные тесты только при изменении публичных контрактов; проверить HTTPS-policy и реальные параметры redirect.
- [ ] 1.3 Выделить общий PKCE-сценарий и порты криптографии/браузера/listener/session sink без JVM-зависимости common-кода; проверить verifier/state/path/code/OAuth error, повторы, отмену, таймаут 180 секунд и отсутствие сохранения при отказе.
- [ ] 1.4 Реализовать адаптеры JVM/macOS arm64/x64 и Node и подключить общий auth login обоих executable; проверить системный браузер, 127.0.0.1/свободный порт, освобождение listener и отсутствие секрета в stdout/stderr, сохранить отдельный session sink IDE.

## 2. Хранилище и жизненный цикл

- [ ] 2.1 Расширить версионированную файловую сессию clientId и безопасным username из userinfo; проверить нормализацию URL/hash, несовместимую старую сессию, минимальные поля, 0700/0600 и атомарную замену без записи access/ID token и пароля.
- [ ] 2.2 Добавить кеш access token/expiry с запасом 30 секунд и объединением refresh внутри процесса; тестами времени и конкуренции подтвердить отсутствие refresh на каждый запрос и межпроцессные lock/перечитывание/ротацию.
- [ ] 2.3 Сохранить один forced refresh/retry после 401, отсутствие refresh после 403, очистку при invalid_grant/повторном 401 и сохранение файла при transport failure; проверить project-key policy без смены actor.
- [ ] 2.4 Обновить безопасный локальный status и logout с отзывом соответствующим clientId и удалением файла/кеша даже при отказе отзыва; проверить гонку с refresh и отсутствие браузера из serve/tools.
- [ ] 2.5 Удалить парольный путь CLI/MCP, обновить help/README и миграционные сообщения; проверить отсутствие браузера/CI с project key, независимость от версии реестра tools и только execute у новых/изменённых UseCase.

## 3. Автоматические проверки

- [ ] 3.1 Выполнить openspec validate use-pkce-for-cli-mcp --type change --strict --no-interactive; tools/verify fast --change use-pkce-for-cli-mcp и независимое read-only review, исправления и повтор FAST/review по workflow.
- [ ] 3.2 Выполнить tools/verify full --change use-pkce-for-cli-mcp: затронутые backend/frontend build, тесты, Detekt, Spotless, Strictacode compare; compileSharedMcpDependencyGraph и упаковку/установку npm tarball вне Gradle. Сохранить команды/exit codes без изменения защищённых файлов и baseline.

## 4. Внешние проверки до архивирования

- [ ] 4.1 [внешняя проверка] На контуре с PostgreSQL/Keycloak выполнить реальный браузерный login через dsbuilder и dsbuilder-mcp; проверить общий файл, clientId, audience, userinfo, refresh/logout и сохранение web/IDE. Сохранить команды, exit codes и обезличенные результаты без токенов.
- [ ] 4.2 [внешняя проверка] Проверить неверные verifier/state/path/redirect и поддержку переменного loopback-порта фактической версией Keycloak: токены/сессия не сохраняются, listener освобождается. Сохранить измеримые результаты, отсутствие провайдера не считать успехом.
- [ ] 4.3 [внешняя проверка] Выполнить браузерный вход и завершение listener на JVM, macOS arm64/x64 и установленном Node tarball, проверить два процесса с общей refresh-сессией. Сохранить платформы/команды/exit codes; недоступную архитектуру отметить непроверенной и не архивировать без доказательств.
- [ ] 4.4 [внешняя проверка] Проверить serve/tools с текущим доступным реестром без credentials и после входа/выхода, отсутствие интерактивности и утечек в stdio, действующий project key с достаточными/недостаточными scopes и отсутствие смены actor после отказа. Готовность 26 read-tools не является предпосылкой.
