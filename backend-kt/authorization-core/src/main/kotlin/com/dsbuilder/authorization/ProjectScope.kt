package com.dsbuilder.authorization

/** Каталог стабильных project-scopes, используемых сервисами при проверке политики. */
object ProjectScope {
    /** Чтение компонентов. */
    const val COMPONENTS_READ = "components:read"

    /** Изменение компонентов. */
    const val COMPONENTS_WRITE = "components:write"

    /** Удаление компонентов. */
    const val COMPONENTS_DELETE = "components:delete"

    /** Чтение моделей вариаций компонентов. */
    const val COMPONENT_VARIATIONS_READ = "components:variations:read"

    /** Изменение моделей вариаций компонентов. */
    const val COMPONENT_VARIATIONS_WRITE = "components:variations:write"

    /** Удаление моделей вариаций компонентов. */
    const val COMPONENT_VARIATIONS_DELETE = "components:variations:delete"

    /** Чтение токенов. */
    const val TOKENS_READ = "tokens:read"

    /** Изменение токенов. */
    const val TOKENS_WRITE = "tokens:write"

    /** Удаление токенов. */
    const val TOKENS_DELETE = "tokens:delete"

    /** Чтение тем. */
    const val TENANTS_READ = "tenants:read"

    /** Изменение тем. */
    const val TENANTS_WRITE = "tenants:write"

    /** Удаление тем. */
    const val TENANTS_DELETE = "tenants:delete"
}
