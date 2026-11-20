package com.dsbuilder.settings.application

internal data class TokenScopeDescription(val id: String, val title: String, val description: String)

internal fun tokenScopeCatalog(scopes: Set<String>): List<TokenScopeDescription> {
    val entities = mapOf(
        "projects" to "Проекты", "members" to "Участники", "design-systems" to "Дизайн-системы",
        "tenants" to "Темы", "tenants:subthemes" to "Подтемы", "tokens" to "Токены",
        "tokens:group" to "Группы токенов", "tokens:subgroup" to "Подгруппы токенов",
        "components" to "Компоненты", "components:variations" to "Вариации компонентов",
        "documentation" to "Документация",
    )
    val actions = mapOf(
        "read" to "Просмотр данных",
        "write" to "Создание и изменение данных",
        "delete" to "Удаление данных",
    )
    return scopes.sorted().map { id ->
        val entity = requireNotNull(entities[id.substringBeforeLast(':')]) { "Missing scope title: $id" }
        val action = requireNotNull(actions[id.substringAfterLast(':')]) { "Missing scope description: $id" }
        TokenScopeDescription(id, "$entity: $action", action)
    }
}
