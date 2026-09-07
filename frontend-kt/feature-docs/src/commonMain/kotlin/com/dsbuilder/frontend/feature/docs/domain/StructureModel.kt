package com.dsbuilder.frontend.feature.docs.domain

import kotlinx.serialization.Serializable

/**
 * Схема структуры навигации (structure-core.json / structure-user.json).
 *
 * @property schemaVersion версия схемы навигации.
 * @property navigation корневое дерево навигации.
 */
@Serializable
public data class Structure(
    val schemaVersion: String,
    val navigation: List<NavigationNode>,
)

/**
 * Узел дерева навигации.
 *
 * Может быть группой (имеет [items] и не имеет [path]) или страницей (имеет [path]).
 *
 * @property title заголовок узла.
 * @property subjects семантические метки, наследуемые дочерними страницами.
 * @property hidden признак скрытия узла из итоговой документации.
 * @property merge стратегия слияния контента (применяется только для страниц).
 * @property items поддерево навигации (группы/страницы).
 * @property path относительный путь markdown-файла (только для страниц).
 */
@Serializable
public data class NavigationNode(
    val title: String,
    val subjects: List<String>? = null,
    val hidden: Boolean? = null,
    val merge: MergePolicy? = null,
    val items: List<NavigationNode> = emptyList(),
    val path: String? = null,
)

/**
 * Стратегия слияния контента при объединении Core и пользовательской документации.
 */
@Serializable(with = MergePolicySerializer::class)
public enum class MergePolicy {
    /** Добавить пользовательский контент после Core контента. */
    Append,

    /** Добавить пользовательский контент перед Core контентом. */
    Prepend,

    /** Заменить Core контент пользовательским. */
    Replace,
}
