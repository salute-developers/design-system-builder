# Задачи

## 1. Предпосылки и составные операции модели

- [x] 1.1 Подтвердить поставку add-versioned-read-tools и его селектора/метаданных/22 tools; проверить текущие builder, проверки доступа, платформы и отсутствие зависимости от PKCE.
- [x] 1.2 Добавить серверный список конфигураций по designSystemId/componentId и новую операцию итоговых параметров по appearanceId/selectedValueIds; проверить доступ, пустой и частичный выбор, чужие ID, одинаковую ось дважды, приоритет position, сочетания и сохранение полного CLI-экспорта.
- [x] 1.3 Реализовать новую операцию токен-ссылок по appearanceId и полному набору selectedValueIds с проверенными tokenId, ID записей-источников и путями использования; проверить неполные оси, недоказанные строки, чужое оформление, историческую версию и отсутствие вычисления значений темы.
- [x] 1.4 Добавить include=platformParams/reuseConfig в существующие properties/deps; проверить прежние ответы без include, доступные метаданные целей, существующие проверки DS и отсутствие клиентского обхода связей. Вариации по appearanceId сохраняют существующие values/defaults первого Change без нового include или серверной проекции.
- [x] 1.5 Обеспечить одну согласованную read-only транзакцию составного чтения; интеграционным тестом конкурентной записи проверить целостность осей, итоговых параметров, ссылок и метаданных без записи.

## 2. Публикации и проекции документации

- [x] 2.1 Добавить GET publications с опубликованными выпусками/переизданиями, version/platform, items/nextCursor и лимитами 20/100; проверить candidate, порядок, привязку cursor и независимость от наличия публикации модели.
- [x] 2.2 Добавить явный publicationId поиска и фактические HTTP-метаданные, сохранив числовой cursor и прежний ответ; проверить переиздание между страницами, поиск по прежнему ID пока публикация доступна, NOT_FOUND при её недоступности без переключения на active pointer, subjects[], исходные фильтры, чужую публикацию, предел candidate window и регрессионный корпус ранжирования.
- [x] 2.3 Перенести detail/appearanceNames/variationNames CodeBinding и detail=compact фрагмента на сервер; сохранить full без новых параметров, подстрочный name, совместимый строковый cursor bindings и добавить exactName без конфликта семантик. Проверить summary/variations/full, token-binding и отсутствие выдуманного componentId.
- [x] 2.4 Сохранить существующие active и ID-маршруты navigation/page/bindings без новых коротких путей; проверить их прежние тела, HTTP-метаданные и сохранение 401/403/503 при простом разрешении publicationId клиентом.
- [x] 2.5 Обновить OpenAPI ds-service/documentation-service и контрактные тесты обоих сервисов для новых параметров, списка конфигураций, чтения итоговых параметров, токен-ссылок и прежних ответов без них; проверить неизменность схемы JS и платформ.

## 3. Итоговые MCP tools

- [x] 3.1 Подключить component_configurations_list, перевести component_config_get на appearanceId/selectedValueIds и серверные итоговые параметры; подключить component_tokens_get/properties/dependencies, удалив локальные предметные вычисления. Сохранить component_get и component_variations_get первого Change: мета по componentId и оси по appearanceId соответственно; проверить существующие values/defaults без include=values,defaults и отсутствие вызовов GET /components/{id}/variations. Проверить единый runtime и только execute у каждого нового/изменённого UseCase.
- [x] 3.2 Подключить documentation_publications_list, subjects[], явные публикации и серверные проекции; использовать существующие ID-маршруты, не скрывать ошибки разрешения, не подставлять latest/platform и не блокировать явный ID унаследованной версией. При недоступности публикации вернуть NOT_FOUND без автоматического повтора поиска.
- [x] 3.3 Обновить схемы, аннотации и контракт tools/list до 27 имён обоих launcher; проверить параллельные designSystem URI, отсутствие credentials/workspace, секретов и смены actor, сохранить project_get_status и README несовместимых MCP-параметров.

## 4. Проверки и независимое рассмотрение

- [x] 4.1 Выполнить openspec validate add-composite-read-tools --type change --strict --no-interactive; tools/verify fast --change add-composite-read-tools и независимое read-only review с исправлениями и повтором FAST/review по workflow.
- [x] 4.2 Выполнить tools/verify full --change add-composite-read-tools: backend/frontend build, тесты, Detekt, Spotless, Strictacode compare, compileSharedMcpDependencyGraph и npm tarball; сохранить команды/exit codes без изменений защищённых файлов и baseline. Отдельные backend/frontend/JS FULL, compileSharedMcpDependencyGraph и npm tarball прошли. Общий `tools/verify full` завершился с кодом 1 на Strictacode compare; пользователь 2026-10-27 явно разрешил завершить задачу и архивировать Change с этим исключением. Baseline и policy не менялись.

## 5. Внешние проверки до архивирования

- [x] 5.1 [внешняя проверка] Через оба stdio launcher выполнить initialize/tools/list и все 27 tools на DS с draft, двумя публикациями и переизданной документацией; сравнить ответы с HTTP, selectedValueIds, приоритет осей, tokenId/пути и проекции, проверить передачу publicationId между страницами и NOT_FOUND без автоматического повтора после недоступности публикации. Проверить установленный вне Gradle Node tarball; сохранить команды и exit codes.
- [x] 5.2 [внешняя проверка] На том же PostgreSQL-контуре проверить прежние web/admin/CLI-запросы и полный экспорт, user session и project key со scopes и без, недоступный documentation-service и чужие ресурсы; сохранить категории ошибок без утечки или смены actor. Отсутствующее окружение не считать успехом.
