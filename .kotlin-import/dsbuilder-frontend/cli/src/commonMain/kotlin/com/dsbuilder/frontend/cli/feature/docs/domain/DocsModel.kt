package com.dsbuilder.frontend.cli.feature.docs.domain

import kotlinx.serialization.Serializable

/**
 * Итоговая структура документации (docs.json).
 *
 * @property navigation resolved дерево навигации.
 */
@Serializable
public data class ResolvedDocs(
    val navigation: List<ResolvedNavigationNode>,
)

/**
 * Разрешённый узел дерева навигации.
 *
 * @property title заголовок узла.
 * @property subjects resolved семантические метки (после наследования от родительской группы).
 * @property hidden признак скрытия (если установлен, узел исключается из итогового дерева).
 * @property items поддерево навигации.
 * @property path относительный путь страницы (только для страниц).
 * @property contentFormat формат контента (обычно "markdown").
 * @property contentRefs ссылки на content-файлы.
 */
@Serializable
public data class ResolvedNavigationNode(
    val title: String,
    val subjects: List<String>,
    val hidden: Boolean? = null,
    val items: List<ResolvedNavigationNode> = emptyList(),
    val path: String? = null,
    val contentFormat: String = "markdown",
    val contentRefs: List<ContentRef> = emptyList(),
)

/**
 * Ссылка на content-файл в пакете документации.
 *
 * @property source источник контента: CORE или USER.
 * @property path относительный путь в архиве.
 */
@Serializable
public data class ContentRef(
    val source: Source,
    val path: String,
)

/**
 * Источник контента при слиянии Core и пользовательской документации.
 */
@Serializable
public enum class Source {
    /** Контент из Core шаблонов. */
    Core,

    /** Контент из пользовательской документации. */
    User,
}
