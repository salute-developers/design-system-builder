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
import com.dsbuilder.frontend.feature.theme.application.TokenEditCommand
import com.dsbuilder.frontend.feature.theme.application.TokenEditRemoteSource
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** Преобразует закрытую типизированную команду по декларативному контракту HTTP. */
internal class HttpTokenEditRemoteSource(private val clients: AuthenticatedHttpClientFactory) : TokenEditRemoteSource {
    override suspend fun edit(
        runtime: RuntimeResolution.Resolved,
        command: TokenEditCommand,
        options: DraftEditOptions,
    ): HttpMutationResult {
        val root = "/api/projects/${runtime.context.projectId.value.encodeEditorId()}" +
            "/design-systems/${runtime.context.designSystemId.value.encodeEditorId()}"
        val encoded = editorCommandJson.encodeToJsonElement<TokenEditCommand>(command).jsonObject
        val endpoint = endpoints.getValue(encoded.getValue("operation").jsonPrimitive.content)
        val request = endpoint.request(root, encoded, options.idempotencyKey, options.baseRevision)
        val client = clients.create(runtime.apiUrl.value, runtime.credential)
        val response = client.mutate(request)
        return client.confirmTruncatedMutation(response, listOf("$root/tokens", "$root/token-values"))
    }
}

private val endpoints = mapOf(
    "token_create" to EditorEndpoint(
        method = MutationHttpMethod.POST,
        path = "/tokens",
    ),
    "token_update" to EditorEndpoint(
        method = MutationHttpMethod.PATCH,
        path = "/tokens/{tokenId}",
    ),
    "token_delete" to EditorEndpoint(
        method = MutationHttpMethod.DELETE,
        path = "/tokens/{tokenId}",
        sendsBody = false,
    ),
    "token_value_create" to EditorEndpoint(
        method = MutationHttpMethod.POST,
        path = "/token-values",
    ),
    "token_value_update" to EditorEndpoint(
        method = MutationHttpMethod.PATCH,
        path = "/token-values/{valueId}",
    ),
    "token_value_delete" to EditorEndpoint(
        method = MutationHttpMethod.DELETE,
        path = "/token-values/{valueId}",
        sendsBody = false,
    ),
)
