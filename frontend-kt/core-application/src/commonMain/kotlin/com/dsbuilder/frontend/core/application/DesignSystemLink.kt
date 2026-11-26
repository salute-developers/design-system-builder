package com.dsbuilder.frontend.core.application

import com.dsbuilder.frontend.core.domain.DesignSystemId
import com.dsbuilder.frontend.core.domain.DesignSystemSelection
import com.dsbuilder.frontend.core.domain.ProjectId
import com.dsbuilder.frontend.core.domain.TargetPlatform

/** Parses and writes the first version of portable design-system links. */
public object DesignSystemLink {
    private const val PREFIX = "dsbuilder://projects/"
    private val identifier = Regex("[A-Za-z0-9][A-Za-z0-9_-]*")
    private val version = Regex("[A-Za-z0-9][A-Za-z0-9._+\\-]*")

    /** Returns a selection, or null for an invalid link. No backend or workspace is consulted. */
    @Suppress("ReturnCount")
    public fun parse(uri: String): DesignSystemSelection? {
        if (!uri.startsWith(PREFIX) || '#' in uri || '@' in uri) return null
        val pieces = uri.removePrefix(PREFIX).split('?', limit = 3)
        if (pieces.size > 2 || pieces.size == 2 && pieces[1].isEmpty()) return null
        val path = pieces[0].split('/')
        if (path.size != 3 || path[1] != "design-systems") return null
        val projectId = path[0].takeIf(identifier::matches) ?: return null
        val designSystemId = path[2].takeIf(identifier::matches) ?: return null
        val values = queryFields(pieces.getOrNull(1)) ?: return null
        return selection(projectId, designSystemId, values)
    }

    private fun queryFields(raw: String?): Map<String, String>? {
        val pairs = raw?.split('&').orEmpty().map { field ->
            val pair = field.split('=', limit = 3)
            if (pair.size != 2) return null
            pair[0] to pair[1]
        }
        val keys = pairs.map { it.first }
        if (keys.distinct().size != keys.size || keys.any { it !in setOf("version", "platform") }) return null
        return pairs.toMap()
    }

    private fun selection(
        projectId: String,
        designSystemId: String,
        values: Map<String, String>,
    ): DesignSystemSelection? {
        val selectedVersion = values["version"]?.let { it.takeIf(version::matches) ?: return null }
        val platform = values["platform"]?.let { TargetPlatform.fromCliValue(it) ?: return null }
        return DesignSystemSelection(ProjectId(projectId), DesignSystemId(designSystemId), selectedVersion, platform)
    }

    /** Canonical, secret-free representation of one selection. */
    public fun format(selection: DesignSystemSelection): String {
        val query = listOfNotNull(
            selection.version?.let { "version=$it" },
            selection.platform?.let { "platform=${it.cliValue}" },
        ).joinToString("&")
        val link = "$PREFIX${selection.projectId.value}/design-systems/${selection.designSystemId.value}" +
            if (query.isEmpty()) "" else "?$query"
        require(parse(link) == selection) { "Selection cannot be represented as a design-system link." }
        return link
    }
}
