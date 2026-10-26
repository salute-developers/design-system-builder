package com.dsbuilder.frontend.feature.ds.data

import com.dsbuilder.frontend.feature.ds.application.ModelReadCommand
import com.dsbuilder.frontend.feature.ds.application.ModelReadOperation

/** Существующий HTTP-маршрут и ожидаемый контракт страницы для одного чтения. */
internal data class ModelReadHttpRequest(val url: String, val paged: Boolean, val limit: Int) {
    companion object {
        fun create(projectId: String, designSystemId: String, command: ModelReadCommand): ModelReadHttpRequest {
            val page = command.operation in PAGE_OPERATIONS || isPublishedVersion(command)
            val limit = if (command.operation == ModelReadOperation.VERSION && page) 1 else command.limit ?: 50
            val query = parameters(command, page, limit).entries.joinToString("&") {
                "${encode(it.key)}=${encode(it.value)}"
            }
            val url = "/api/projects/${encode(projectId)}/ds/${path(command, designSystemId)}" +
                if (query.isEmpty()) "" else "?$query"
            return ModelReadHttpRequest(url, page, limit)
        }
        private fun path(command: ModelReadCommand, designSystemId: String): String {
            val id = encode(command.resourceId.orEmpty())
            val ds = "design-systems/${encode(designSystemId)}"
            return when (command.operation) {
                ModelReadOperation.CONTEXT -> ds
                ModelReadOperation.VERSIONS ->
                    "design-system-versions/by-design-system/" +
                        "${encode(designSystemId)}"
                ModelReadOperation.VERSION -> versionPath(command, designSystemId, ds)
                ModelReadOperation.CHANGES -> "$ds/changes"
                ModelReadOperation.TENANTS -> "$ds/tenants"
                ModelReadOperation.TOKENS -> "$ds/tokens"
                ModelReadOperation.TOKEN_GROUPS -> "$ds/token-groups"
                ModelReadOperation.COMPONENTS -> "$ds/components"
                ModelReadOperation.COMPONENT_STYLES -> "$ds/components/$id/styles"
                else -> resourcePath(command, id)
            }
        }

        private fun resourcePath(command: ModelReadCommand, id: String): String = when (command.operation) {
            ModelReadOperation.TOKEN -> "tokens/$id"
            ModelReadOperation.TOKEN_VALUES -> "tokens/$id/values"
            ModelReadOperation.PALETTE -> "tenants/$id/palette"
            ModelReadOperation.COMPONENT -> "components/$id"
            ModelReadOperation.APPEARANCE_VARIATIONS -> "appearances/$id/variations"
            else -> error("Unsupported resource operation")
        }

        private fun versionPath(command: ModelReadCommand, designSystemId: String, ds: String): String =
            if (command.version == "draft") {
                ds
            } else {
                "design-system-versions/by-design-system/${encode(designSystemId)}"
            }

        private fun parameters(command: ModelReadCommand, page: Boolean, limit: Int): Map<String, String> {
            val parameters = command.filters.toMutableMap()
            if (command.operation != ModelReadOperation.COMPONENT && command.operation != ModelReadOperation.VERSIONS) {
                parameters["version"] = command.version ?: "draft"
            }
            if (command.operation == ModelReadOperation.VERSIONS) command.version?.let { parameters["version"] = it }
            if (page) {
                parameters["limit"] = limit.toString()
                command.cursor?.let { parameters["cursor"] = it }
            }
            return parameters
        }

        val PAGE_OPERATIONS = setOf(
            ModelReadOperation.VERSIONS,
            ModelReadOperation.CHANGES,
            ModelReadOperation.TENANTS,
            ModelReadOperation.TOKENS,
            ModelReadOperation.TOKEN_GROUPS,
            ModelReadOperation.COMPONENTS,
            ModelReadOperation.COMPONENT_STYLES,
        )
    }
}

private fun encode(value: String): String = buildString {
    value.encodeToByteArray().forEach {
        val byte = it.toInt() and 0xff
        val letter = byte in 'a'.code..'z'.code || byte in 'A'.code..'Z'.code
        if (letter || byte in '0'.code..'9'.code || byte.toChar() in "-._~") {
            append(byte.toChar())
        } else {
            append("%" + byte.toString(16).uppercase().padStart(2, '0'))
        }
    }
}

internal fun isPublishedVersion(command: ModelReadCommand): Boolean =
    command.operation == ModelReadOperation.VERSION && command.version != "draft"
