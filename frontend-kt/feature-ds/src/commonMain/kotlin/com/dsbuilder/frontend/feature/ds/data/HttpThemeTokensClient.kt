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
    ): ModelReadResult = readAll(clients.create(apiUrl, credential), sections(context, versionId))

    override suspend fun exportSource(
        apiUrl: String,
        credential: BackendCredential,
        context: ThemeContext,
        versionId: String?,
    ): ModelReadResult {
        val version = versionId?.let { "versionId=${encodeModelSegment(it)}" }
        val paths = sections(context, versionId) + mapOf(
            "palette" to "${tenant(context)}/palette${query(version)}",
            "groups" to "${system(context)}/token-groups${query(version)}",
        )
        return readAll(clients.create(apiUrl, credential), paths)
    }

    private fun sections(context: ThemeContext, versionId: String?): Map<String, String> {
        val version = versionId?.let { "versionId=${encodeModelSegment(it)}" }
        return mapOf(
            "tokens" to "${system(context)}/tokens${query(version)}",
            "values" to "${tenant(context)}/token-values${query(version, "types=${encodeModelSegment(COLOR_TYPES)}")}",
            "typography" to "${tenant(context)}/typography-styles${query(version)}",
            "sizes" to "${tenant(context)}/size-tokens${query(version)}",
        )
    }

    /** Все чтения параллельно; первый отказ возвращается вместо частичного ответа. */
    private suspend fun readAll(client: AuthenticatedHttpClient, paths: Map<String, String>): ModelReadResult =
        coroutineScope {
            val results = paths.map { (name, path) -> async { name to read(client, path) } }.awaitAll()
            results.firstNotNullOfOrNull { (_, result) -> result as? ModelReadResult.Failed }
                ?: ModelReadResult.Success(
                    JsonObject(
                        results.associate { (name, result) -> name to (result as ModelReadResult.Success).value },
                    ),
                )
        }

    private fun system(context: ThemeContext) =
        "${root(context.projectId)}/design-systems/${encodeModelSegment(context.designSystemId)}"

    private fun tenant(context: ThemeContext) =
        "${root(context.projectId)}/tenants/${encodeModelSegment(context.tenantId)}"

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
