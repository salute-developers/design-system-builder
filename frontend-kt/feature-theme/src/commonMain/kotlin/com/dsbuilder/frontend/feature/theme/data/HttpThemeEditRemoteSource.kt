package com.dsbuilder.frontend.feature.theme.data

import com.dsbuilder.frontend.core.application.DraftEditOptions
import com.dsbuilder.frontend.core.application.RuntimeResolution
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.EditorEndpoint
import com.dsbuilder.frontend.core.network.HttpMutationResult
import com.dsbuilder.frontend.core.network.MutationHttpMethod
import com.dsbuilder.frontend.core.network.confirmTruncatedMutation
import com.dsbuilder.frontend.core.network.editorCommandJson
import com.dsbuilder.frontend.core.network.encodeEditorId
import com.dsbuilder.frontend.feature.theme.application.ThemeEditCommand
import com.dsbuilder.frontend.feature.theme.application.ThemeEditRemoteSource
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** Преобразует закрытую типизированную команду по декларативному контракту HTTP. */
internal class HttpThemeEditRemoteSource(private val clients: AuthenticatedHttpClientFactory) : ThemeEditRemoteSource {
    override suspend fun edit(
        runtime: RuntimeResolution.Resolved,
        command: ThemeEditCommand,
        options: DraftEditOptions,
    ): HttpMutationResult {
        val root = "/api/projects/${runtime.context.projectId.value.encodeEditorId()}" +
            "/design-systems/${runtime.context.designSystemId.value.encodeEditorId()}"
        val encoded = editorCommandJson.encodeToJsonElement<ThemeEditCommand>(command).jsonObject
        val endpoint = endpoints.getValue(encoded.getValue("operation").jsonPrimitive.content)
        val request = endpoint.request(root, encoded, options.idempotencyKey, options.baseRevision)
        val client = clients.create(runtime.apiUrl.value, runtime.credential)
        val response = client.mutate(request)
        return client.confirmTruncatedMutation(
            response,
            listOf("$root/tokens", "$root/token-values", "$root/token-groups"),
        )
    }
}

private val endpoints = mapOf(
    "color_token_create" to EditorEndpoint(
        method = MutationHttpMethod.POST,
        path = "/tenants/{tenantId}/color-tokens",
        bodyField = "input",
    ),
    "color_token_values_update" to EditorEndpoint(
        method = MutationHttpMethod.PUT,
        path = "/tenants/{tenantId}/color-tokens/{tokenId}/values",
        bodyField = "input",
    ),
    "color_token_move" to EditorEndpoint(
        method = MutationHttpMethod.POST,
        path = "/tenants/{tenantId}/color-tokens/{tokenId}/move",
        bodyField = "input",
    ),
    "color_token_delete" to EditorEndpoint(
        method = MutationHttpMethod.DELETE,
        path = "/tenants/{tenantId}/color-tokens/{tokenId}",
        bodyField = "input",
    ),
    "token_group_create" to EditorEndpoint(
        method = MutationHttpMethod.POST,
        path = "/tenants/{tenantId}/token-groups",
        bodyField = "input",
    ),
    "token_group_update" to EditorEndpoint(
        method = MutationHttpMethod.PATCH,
        path = "/tenants/{tenantId}/token-groups/{groupId}",
        bodyField = "input",
    ),
    "token_group_delete" to EditorEndpoint(
        method = MutationHttpMethod.DELETE,
        path = "/tenants/{tenantId}/token-groups/{groupId}",
        bodyField = "input",
    ),
    "size_token_value_update" to EditorEndpoint(
        method = MutationHttpMethod.PUT,
        path = "/tenants/{tenantId}/size-tokens/{tokenId}/value",
        bodyField = "input",
    ),
    "typography_style_update" to EditorEndpoint(
        method = MutationHttpMethod.PATCH,
        path = "/tenants/{tenantId}/typography-styles/{tokenId}",
        bodyField = "input",
    ),
)
