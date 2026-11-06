package com.dsbuilder.frontend.feature.ds.data

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClient
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.ds.application.ModelReadResult
import com.dsbuilder.frontend.feature.ds.application.ThemeContext
import com.dsbuilder.frontend.feature.ds.application.ThemeTokensClient
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

private const val COLOR_TYPES = "color,gradient"

/** Ktor-реализация [ThemeTokensClient]. */
public class HttpThemeTokensClient(private val clients: AuthenticatedHttpClientFactory) : ThemeTokensClient {
    override suspend fun versions(
        apiUrl: String,
        credential: BackendCredential,
        projectId: String,
        designSystemId: String,
    ): ModelReadResult = read(
        clients.create(apiUrl, credential),
        "${root(projectId)}/design-system-versions/by-design-system/${encodeModelSegment(designSystemId)}",
    )

    override suspend fun tokens(
        apiUrl: String,
        credential: BackendCredential,
        context: ThemeContext,
        versionId: String?,
    ): ModelReadResult = coroutineScope {
        val client = clients.create(apiUrl, credential)
        val system = "${root(context.projectId)}/design-systems/${encodeModelSegment(context.designSystemId)}"
        val tenant = "${root(context.projectId)}/tenants/${encodeModelSegment(context.tenantId)}"
        val version = versionId?.let { "versionId=${encodeModelSegment(it)}" }
        val paths = mapOf(
            "tokens" to "$system/tokens${query(version)}",
            "values" to "$tenant/token-values${query(version, "types=${encodeModelSegment(COLOR_TYPES)}")}",
            "typography" to "$tenant/typography-styles${query(version)}",
            "sizes" to "$tenant/size-tokens${query(version)}",
        )
        val results = paths.map { (name, path) -> async { name to read(client, path) } }.awaitAll()
        results.firstNotNullOfOrNull { (_, result) -> result as? ModelReadResult.Failed }
            ?: ModelReadResult.Success(
                JsonObject(results.associate { (name, result) -> name to (result as ModelReadResult.Success).value }),
            )
    }

    private suspend fun read(client: AuthenticatedHttpClient, path: String): ModelReadResult =
        when (val response = client.get(path)) {
            is AuthenticatedHttpResult.Failure -> modelReadFailure(response.statusCode)
            is AuthenticatedHttpResult.Success -> decode(response.body)
        }

    private fun decode(body: String): ModelReadResult = runCatching<JsonElement> { Json.parseToJsonElement(body) }
        .fold(
            onSuccess = { ModelReadResult.Success(it) },
            onFailure = {
                ModelReadResult.Failed("INVALID_BACKEND_RESPONSE", "Backend returned an invalid theme response.")
            },
        )

    private fun root(projectId: String) = "/api/projects/${encodeModelSegment(projectId)}/ds"

    private fun query(vararg parts: String?): String =
        parts.filterNotNull().joinToString("&").let { if (it.isEmpty()) "" else "?$it" }
}
