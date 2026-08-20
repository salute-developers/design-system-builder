package com.dsbuilder.frontend.cli.feature.docs.domain

/**
 * Движок валидации инвариантов пакета документации.
 *
 * Проверяет:
 * 1. Все content-ссылки ссылаются на существующие файлы в content-директории.
 * 2. Нет дубликатов относительных путей страниц в дереве навигации.
 * 3. Пути безопасны — нет path traversal (`..`), абсолютных путей.
 * 4. Все артефакты, объявленные в manifest, существуют в директории агрегатора.
 *
 * Интерфейс не зависит от файловой системы — реализация (port) находится в data.
 */
public interface DocsValidationEngine {
    /**
     * Выполняет полную валидацию пакета документации.
     *
     * @param resolvedDocs resolved-дерево навигации (`docs.json`).
     * @param manifest манифест пакета (`manifest.json`).
     * @param docsDir директория агрегатора, содержащая `content/`, `assets/`, `meta/`.
     * @return список ошибок валидации (пусто при успехе).
     */
    public fun validate(
        resolvedDocs: ResolvedDocs,
        manifest: Manifest,
        docsDir: String,
    ): List<ValidationError>
}

/**
 * Проверяет на дубликаты путей в дереве навигации.
 *
 * @param navigation дерево навигации.
 * @return список дубликатов.
 */
public fun validateDuplicatePaths(
    navigation: List<ResolvedNavigationNode>,
): List<ValidationError.DuplicatePath> {
    val errors = mutableListOf<ValidationError.DuplicatePath>()
    val seenPaths = mutableSetOf<String>()
    collectPaths(navigation, seenPaths, errors)
    return errors
}

/**
 * Проверяет безопасность путей (path traversal).
 *
 * @param navigation дерево навигации.
 * @return список небезопасных путей.
 */
public fun validatePathSafety(
    navigation: List<ResolvedNavigationNode>,
): List<ValidationError.InvalidPathTraversal> {
    val errors = mutableListOf<ValidationError.InvalidPathTraversal>()
    collectPathsForSafety(navigation, errors)
    return errors
}

/**
 * Проверяет, что content-ссылки из [resolvedDocs] не дублируют друг друга
 * и не указывают на одни и те же файлы.
 *
 * @param resolvedDocs resolved-дерево навигации.
 * @param docsDir директория агрегатора (для формирования полного пути).
 * @return список дубликатов content-путь-к-файлу.
 */
public fun validateDuplicateContentRefs(
    resolvedDocs: ResolvedDocs,
    docsDir: String,
): List<String> {
    val allPaths = collectContentRefs(resolvedDocs.navigation).map { ref ->
        val prefix = when (ref.ref.source) {
            Source.Core -> "core"
            Source.User -> "user"
        }
        "$docsDir/content/$prefix/${ref.ref.path}"
    }
    return allPaths.filter { allPaths.count { p -> p == it } > 1 }
}

/**
 * Рекурсивно собирает все contentRefs из дерева навигации.
 */
internal fun collectContentRefs(
    nodes: List<ResolvedNavigationNode>,
): List<ContentRefWithPath> {
    val refs = mutableListOf<ContentRefWithPath>()
    nodes.forEach { node ->
        node.contentRefs.forEach { ref ->
            refs.add(ContentRefWithPath(ref, node.path))
        }
        refs += collectContentRefs(node.items)
    }
    return refs
}

/**
 * ContentRef, который знает свой родительский path в дереве навигации.
 */
internal data class ContentRefWithPath(
    val ref: ContentRef,
    val nodePath: String?,
) {
    /**
     * Полный путь к контенту относительно директории агрегатора.
     */
    fun fullPath(docsDir: String): String {
        val prefix = when (ref.source) {
            Source.Core -> "core"
            Source.User -> "user"
        }
        return "$docsDir/content/$prefix/${ref.path}"
    }
}

/**
 * Рекурсивно собирает все paths из дерева навигации.
 *
 * @param nodes дерево.
 * @param paths накопитель уникальных путей.
 * @param errors накопитель ошибок дубликатов.
 */
private fun collectPaths(
    nodes: List<ResolvedNavigationNode>,
    paths: MutableSet<String>,
    errors: MutableList<ValidationError.DuplicatePath>,
) {
    nodes.forEach { node ->
        node.path?.let { path ->
            if (path in paths) {
                errors.add(ValidationError.DuplicatePath(path))
            } else {
                paths += path
            }
        }
        collectPaths(node.items, paths, errors)
    }
}

/**
 * Собирает все пути для проверки path safety.
 *
 * @param nodes дерево.
 * @param errors накопитель небезопасных путей.
 */
private fun collectPathsForSafety(
    nodes: List<ResolvedNavigationNode>,
    errors: MutableList<ValidationError.InvalidPathTraversal>,
) {
    nodes.forEach { node ->
        node.path?.let { path ->
            if (path.startsWith("..") || path.startsWith("/")) {
                errors.add(ValidationError.InvalidPathTraversal(path))
            }
        }
        collectPathsForSafety(node.items, errors)
    }
}
