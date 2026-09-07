package com.dsbuilder.frontend.feature.docs.domain

/**
 * Движок слияния Core и пользовательской навигации.
 *
 * Принимает два дерева навигации от платформенного агрегатора:
 * полное Core-дерево и подмножество пользовательских изменений.
 *
 * Результат — разрешённое дерево с resolved navigation, subjects
 * (после наследования) и contentRefs.
 */
public object MergeEngine {

    /**
     * Сливает Core и User структуры навигации в единое дерево.
     *
     * Алгоритм:
     * 1. Проходим по дереву coreNavigation.
     * 2. Для каждого leaf (страница с path) ищем соответствующий leaf в userNavigation.
     * 3. Если path совпадает — объединяем контент по правилу merge (append/prepend/replace).
     * 4. Если path отсутствует в Core — добавляем User страницу как новую.
     * 5. Если hidden = true для User страницы — исключаем её из результата.
     * 6. Группы объединяются по положению в дереве и совпадающим заголовкам.
     *
     * @param coreStructure полная Core структура от агрегатора.
     * @param userStructure пользовательские изменения от агрегатора.
     * @return resolved docs с объединённым деревом.
     */
    public fun merge(
        coreStructure: Structure,
        userStructure: Structure,
    ): ResolvedDocs {
        val resolvedNodes =
            mergeNodes(coreStructure.navigation, userStructure.navigation, inheritedSubjects = emptyList())
        return ResolvedDocs(resolvedNodes)
    }

    private fun mergeNodes(
        coreNodes: List<NavigationNode>,
        userNodes: List<NavigationNode>,
        inheritedSubjects: List<String>,
    ): List<ResolvedNavigationNode> {
        val userByTitle = userNodes.filter { it.path == null }.associateBy { it.title }

        val result = mutableListOf<ResolvedNavigationNode>()

        for (coreNode in coreNodes) {
            val mergedNode = buildMergedNode(coreNode, userNodes, userByTitle, inheritedSubjects)
            if (mergedNode.hidden != true) {
                result.add(mergedNode)
            }
        }

        // Add new user nodes that are not in core
        val coreTitles = coreNodes.map { it.title }
        for (userNode in userNodes) {
            if (userNode.title !in coreTitles) {
                addUserOnlyNode(userNode, inheritedSubjects, result)
            }
        }

        return result
    }

    private fun buildMergedNode(
        coreNode: NavigationNode,
        userNodes: List<NavigationNode>,
        userByTitle: Map<String, NavigationNode>,
        inheritedSubjects: List<String>,
    ): ResolvedNavigationNode {
        val userMatch = userNodes.firstOrNull { it.title == coreNode.title }

        return if (userMatch != null) {
            mergeNodeByContent(coreNode, userMatch, inheritedSubjects)
        } else if (coreNode.path != null) {
            buildResolvedLeaf(
                coreNode = coreNode,
                userNode = null,
                subjects = resolveSubjects(coreNode, inheritedSubjects),
            )
        } else {
            buildMergedGroup(coreNode, userByTitle, inheritedSubjects)
        }
    }

    private fun buildMergedGroup(
        coreNode: NavigationNode,
        userByTitle: Map<String, NavigationNode>,
        inheritedSubjects: List<String>,
    ): ResolvedNavigationNode {
        val userGroup = userByTitle[coreNode.title]
        val childSubjects = resolveSubjects(coreNode, inheritedSubjects)
        val userChildren = if (userGroup != null && userGroup.items.isNotEmpty()) {
            userGroup.items
        } else {
            emptyList()
        }
        val mergedChildren = mergeNodes(coreNode.items, userChildren, childSubjects)
        return buildResolvedGroup(coreNode, mergedChildren, childSubjects)
    }

    private fun addUserOnlyNode(
        userNode: NavigationNode,
        inheritedSubjects: List<String>,
        result: MutableList<ResolvedNavigationNode>,
    ) {
        if (userNode.path != null) {
            val userSubjects = userNode.subjects ?: inheritedSubjects
            if (userNode.hidden != true) {
                result.add(buildResolvedLeaf(null, userNode, userSubjects))
            }
        } else {
            val userSubjects = userNode.subjects ?: inheritedSubjects
            val mergedChildren = mergeNodes(emptyList(), userNode.items, userSubjects)
            val resolvedGroup = buildResolvedGroup(userNode, mergedChildren, userSubjects)
            if (resolvedGroup.hidden != true) {
                result.add(resolvedGroup)
            }
        }
    }

    private fun mergeNodeByContent(
        coreNode: NavigationNode,
        userNode: NavigationNode,
        inheritedSubjects: List<String>,
    ): ResolvedNavigationNode {
        val userSubjects = userNode.subjects ?: inheritedSubjects
        val coreSubjects = coreNode.subjects ?: inheritedSubjects

        if (coreNode.path != null && userNode.path == null && userNode.items.isEmpty()) {
            // User node targets a core page but is defined as group — merge children
            val childSubjects = userSubjects.ifEmpty { coreSubjects }
            val mergedChildren = mergeNodes(coreNode.items, userNode.items, childSubjects)
            return buildResolvedGroup(userNode, mergedChildren, childSubjects)
        }

        if (coreNode.path != null && userNode.path != null) {
            // Both are pages — merge contentRefs
            return buildResolvedMergedLeaf(coreNode, userNode, userSubjects)
        }

        // Fallback: treat as group
        val mergedChildren = mergeNodes(coreNode.items, userNode.items, userSubjects)
        return buildResolvedGroup(userNode, mergedChildren, userSubjects)
    }

    private fun buildResolvedMergedLeaf(
        coreNode: NavigationNode,
        userNode: NavigationNode,
        subjects: List<String>,
    ): ResolvedNavigationNode {
        val mergePolicy = userNode.merge ?: MergePolicy.Append
        val corePath = resolveContentPath(coreNode.path!!, "core")
        val userPath = resolveContentPath(userNode.path!!, "user")

        val contentRefs = when (mergePolicy) {
            MergePolicy.Prepend -> listOf(
                ContentRef(Source.User, userPath),
                ContentRef(Source.Core, corePath),
            )
            MergePolicy.Replace -> listOf(
                ContentRef(Source.User, userPath),
            )
            else -> listOf(
                ContentRef(Source.Core, corePath),
                ContentRef(Source.User, userPath),
            )
        }

        return ResolvedNavigationNode(
            title = userNode.title,
            subjects = subjects,
            hidden = userNode.hidden ?: coreNode.hidden,
            items = emptyList(),
            path = coreNode.path,
            contentFormat = "markdown",
            contentRefs = contentRefs,
        )
    }

    private fun buildResolvedLeaf(
        coreNode: NavigationNode?,
        userNode: NavigationNode?,
        subjects: List<String>,
    ): ResolvedNavigationNode {
        val targetNode = userNode ?: coreNode
            ?: error("Both coreNode and userNode are null")

        val effectivePath = targetNode.path
            ?: error("NavigationNode must have a path when buildResolvedLeaf is called")

        val source = if (coreNode != null && userNode != null) {
            // This case should not be reached; leaf merging is done by buildResolvedMergedLeaf
            Source.Core
        } else if (coreNode != null) {
            Source.Core
        } else {
            Source.User
        }

        val contentPath = resolveContentPath(effectivePath, source.name.lowercase())

        return ResolvedNavigationNode(
            title = targetNode.title,
            subjects = subjects,
            items = emptyList(),
            path = effectivePath,
            contentFormat = "markdown",
            contentRefs = listOf(ContentRef(source, contentPath)),
        )
    }

    private fun buildResolvedGroup(
        node: NavigationNode,
        items: List<ResolvedNavigationNode>,
        subjects: List<String>,
    ): ResolvedNavigationNode {
        return ResolvedNavigationNode(
            title = node.title,
            subjects = subjects,
            hidden = node.hidden,
            items = items,
            path = null,
        )
    }

    private fun resolveSubjects(node: NavigationNode, inherited: List<String>): List<String> {
        return node.subjects ?: inherited
    }

    private fun resolveContentPath(relativePath: String, sourcePrefix: String): String {
        return "content/$sourcePrefix/$relativePath"
    }
}
