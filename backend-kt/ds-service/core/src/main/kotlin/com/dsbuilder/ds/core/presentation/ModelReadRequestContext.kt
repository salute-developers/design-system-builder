package com.dsbuilder.ds.core.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadQuery
import com.dsbuilder.ds.core.application.ModelReadSelection
import io.ktor.server.application.ApplicationCall

/** Проверяет селекторы чтения отдельно от проверки доверенного actor. */
suspend fun ApplicationCall.modelReadContext(evaluator: PolicyEvaluator): DsRequestContext? {
    val context = TrustedDsRequestContextMapper.map(request.headers, evaluator)
    if (context == null) {
        respondFailure(DsFailure.Forbidden)
        return null
    }
    val read = parseReadQuery()
    if (read == null) {
        respondFailure(DsFailure.InvalidRequest("INVALID_QUERY"))
        return null
    }
    return selectReadContext(context.copy(readQuery = read))
}

private fun ApplicationCall.parseReadQuery(): ModelReadQuery? {
    val names = listOf("limit", "cursor", "name", "query", "platform", "groupId", "parentId", "type", "shade")
    val parameters = request.queryParameters
    val limit = parameters["limit"]?.takeIf { it.matches(Regex("[0-9]+")) }?.toIntOrNull()
    val invalidLimit = parameters["limit"] != null && (limit == null || limit !in 1..200)
    val conflictingNames = parameters["name"] != null && parameters["query"] != null
    val repeated = names.any { parameters.getAll(it).orEmpty().size > 1 }
    val invalidShape = invalidLimit || conflictingNames || repeated
    val invalidParent = parameters["parentId"]?.let { raw ->
        runCatching { java.util.UUID.fromString(raw).toString() }.getOrNull() != raw.lowercase()
    } ?: false
    if (invalidShape || parameters["cursor"] == "" || invalidParent) return null
    val read = ModelReadQuery(
        limit = limit, cursor = parameters["cursor"], name = parameters["name"], query = parameters["query"],
        platform = parameters["platform"], groupId = parameters["groupId"], parentId = parameters["parentId"],
        type = parameters["type"], shade = parameters["shade"], version = parameters["version"],
    )
    return read
}

private suspend fun ApplicationCall.selectReadContext(queryContext: DsRequestContext): DsRequestContext? =
    when (
        val selection = ModelReadSelection.parse(
            request.queryParameters.getAll("version").orEmpty(),
            request.queryParameters.getAll("versionId").orEmpty(),
        )
    ) {
        is DsResult.Failure -> {
            respondFailure(selection.error)
            null
        }
        is DsResult.Success -> when (val value = selection.value) {
            ModelReadSelection.Draft -> queryContext
            is ModelReadSelection.Published -> queryContext.copy(version = value.version)
            is ModelReadSelection.ById -> queryContext.copy(versionId = value.id)
        }
    }
