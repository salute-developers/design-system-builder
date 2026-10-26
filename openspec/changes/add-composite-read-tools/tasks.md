# Задачи

## 1. Предпосылки и составные операции модели

- [ ] 1.1 Подтвердить поставку add-versioned-read-tools и его селектора/метаданных/22 tools; проверить текущие builder, проверки доступа, платформы и отсутствие зависимости от PKCE.
- [ ] 1.2 Расширить существующий component-config/export альтернативным componentId и selection без изменения старого полного пакета; проверить platform по ID, конфликт с components, выбор styles, частичный/неизвестный/неоднозначный selection и прежний CLI-экспорт.
- [ ] 1.3 Реализовать новую операцию component-config/tokens/query с полным selection, проверенными tokenId и путями использования; проверить неполные оси, недоказанные строки, чужие компоненты, историческую версию и отсутствие вычисления значений темы.
- [ ] 1.4 Добавить include=platformParams/reuseConfig в существующие properties/deps; проверить прежние ответы без include, доступные метаданные целей, существующие проверки DS и отсутствие клиентского обхода связей. Вариации по appearanceId сохраняют существующие values/defaults первого Change без нового include или серверной проекции.
- [ ] 1.5 Обеспечить одну согласованную read-only транзакцию составного чтения; интеграционным тестом конкурентной записи проверить целостность config/ссылок/метаданных и отсутствие записи.

## 2. Публикации и проекции документации

- [ ] 2.1 Добавить GET publications с опубликованными выпусками/переизданиями, version/platform, items/nextCursor и лимитами 20/100; проверить candidate, порядок, привязку cursor и независимость от наличия публикации модели.
- [ ] 2.2 Добавить явный publicationId поиска и фактические HTTP-метаданные, сохранив числовой cursor и прежний ответ; проверить переиздание между страницами с закреплённым ID, subjects[], исходные фильтры, чужую публикацию, предел candidate window и регрессионный корпус ранжирования.
- [ ] 2.3 Перенести detail/appearanceNames/variationNames CodeBinding и detail=compact фрагмента на сервер; сохранить full без новых параметров, подстрочный name, совместимый строковый cursor bindings и добавить exactName без конфликта семантик. Проверить summary/variations/full, token-binding и отсутствие выдуманного componentId.
- [ ] 2.4 Сохранить существующие active и ID-маршруты navigation/page/bindings без новых коротких путей; проверить их прежние тела, HTTP-метаданные и сохранение 401/403/503 при простом разрешении publicationId клиентом.
- [ ] 2.5 Обновить OpenAPI ds-service/documentation-service и контрактные тесты обоих сервисов для новых параметров, двух новых операций и прежних ответов без них; проверить неизменность схемы JS и платформ.

## 3. Итоговые MCP tools

- [ ] 3.1 Перевести component_config_get на componentId/объект selection и серверный экспорт; подключить component_tokens_get/properties/dependencies, удалив локальные предметные вычисления. Сохранить component_get и component_variations_get первого Change: мета по componentId и оси по appearanceId соответственно; проверить существующие values/defaults без include=values,defaults и отсутствие вызовов GET /components/{id}/variations. Проверить единый runtime и только execute у каждого нового/изменённого UseCase.
- [ ] 3.2 Подключить documentation_publications_list, subjects[], явные публикации и серверные проекции; использовать существующие ID-маршруты, не скрывать ошибки разрешения, не подставлять latest/platform и не блокировать явный ID унаследованной версией.
- [ ] 3.3 Обновить схемы, аннотации и контракт tools/list до ровно 26 имён обоих launcher; проверить параллельные designSystem URI, отсутствие credentials/workspace, секретов и смены actor, сохранить project_get_status и README несовместимых MCP-параметров.

## 4. Проверки и независимое рассмотрение

- [ ] 4.1 Выполнить openspec validate add-composite-read-tools --type change --strict --no-interactive; tools/verify fast --change add-composite-read-tools и независимое read-only review с исправлениями и повтором FAST/review по workflow.
- [ ] 4.2 Выполнить tools/verify full --change add-composite-read-tools: backend/frontend build, тесты, Detekt, Spotless, Strictacode compare, compileSharedMcpDependencyGraph и npm tarball; сохранить команды/exit codes без изменений защищённых файлов и baseline.

## 5. Внешние проверки до архивирования

- [ ] 5.1 [внешняя проверка] Через оба stdio launcher выполнить initialize/tools/list и все 26 tools на DS с draft, двумя публикациями и переизданной документацией; сравнить ответы с HTTP, selection/tokenId/пути, проекции и сохранение publicationId между страницами. Проверить установленный вне Gradle Node tarball; сохранить команды и exit codes.
- [ ] 5.2 [внешняя проверка] На том же PostgreSQL-контуре проверить прежние web/admin/CLI-запросы и полный экспорт, user session и project key со scopes и без, недоступный documentation-service и чужие ресурсы; сохранить категории ошибок без утечки или смены actor. Отсутствующее окружение не считать успехом.
