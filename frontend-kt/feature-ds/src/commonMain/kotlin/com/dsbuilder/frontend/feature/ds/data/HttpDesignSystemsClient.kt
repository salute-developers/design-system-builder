package com.dsbuilder.frontend.feature.ds.data

import com.dsbuilder.frontend.core.auth.BackendCredential
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.AuthenticatedHttpResult
import com.dsbuilder.frontend.feature.ds.application.DesignSystemSummary
import com.dsbuilder.frontend.feature.ds.application.DesignSystemsClient
import com.dsbuilder.frontend.feature.ds.application.DesignSystemsReadErrorCode
import com.dsbuilder.frontend.feature.ds.application.DesignSystemsReadResult
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** Общий HTTP-каталог для CLI, MCP и IDE. */
public class HttpDesignSystemsClient(private val clients: AuthenticatedHttpClientFactory) : DesignSystemsClient {
    override suspend fun list(
        apiUrl: String,
        credential: BackendCredential,
        projectId: String,
    ): DesignSystemsReadResult = when (
        val response = clients.create(apiUrl, credential).get(
            "/api/projects/${encodeModelSegment(projectId)}/ds/design-systems",
        )
    ) {
        is AuthenticatedHttpResult.Success -> decode(response.body)
        is AuthenticatedHttpResult.Failure -> if (response.statusCode == 401 &&
            credential is BackendCredential.PersonalAccessToken
        ) {
            DesignSystemsReadResult.Failed(DesignSystemsReadErrorCode.PAT_INVALID, "PAT is invalid or expired.")
        } else {
            SYSTEM_HTTP_FAILURES[response.statusCode] ?: SYSTEM_BACKEND_FAILURE
        }
    }

    private fun decode(body: String): DesignSystemsReadResult = runCatching {
        val array = Json.parseToJsonElement(body) as JsonArray
        DesignSystemsReadResult.Success(
            array.map { element ->
                val item = element as JsonObject
                fun string(key: String): String = (item.getValue(key) as JsonPrimitive).also {
                    require(it.isString && it.content.isNotBlank())
                }.content
                val description = item["description"]?.takeUnless { it == JsonNull }?.let {
                    (it as JsonPrimitive).also { value -> require(value.isString) }.content
                }
                DesignSystemSummary(string("id"), string("name"), description)
            },
        )
    }.getOrElse {
        DesignSystemsReadResult.Failed(
            DesignSystemsReadErrorCode.INVALID_BACKEND_RESPONSE,
            "Backend returned an invalid design-system list.",
        )
    }
}

private val SYSTEM_BACKEND_FAILURE = DesignSystemsReadResult.Failed(
    DesignSystemsReadErrorCode.BACKEND_UNAVAILABLE,
    "Cannot read design systems.",
)

private val SYSTEM_HTTP_FAILURES = mapOf(
    401 to DesignSystemsReadResult.Failed(
        DesignSystemsReadErrorCode.AUTH_REQUIRED,
        "Run dsbuilder auth login and retry.",
    ),
    403 to DesignSystemsReadResult.Failed(DesignSystemsReadErrorCode.FORBIDDEN, "Cannot read design systems."),
    404 to DesignSystemsReadResult.Failed(DesignSystemsReadErrorCode.NOT_FOUND, "Cannot read design systems."),
)
