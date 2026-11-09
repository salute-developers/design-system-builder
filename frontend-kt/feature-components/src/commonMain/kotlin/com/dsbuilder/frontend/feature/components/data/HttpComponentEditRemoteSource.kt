package com.dsbuilder.frontend.feature.components.data

import com.dsbuilder.frontend.core.application.DraftEditOptions
import com.dsbuilder.frontend.core.application.RuntimeResolution
import com.dsbuilder.frontend.core.network.AuthenticatedHttpClientFactory
import com.dsbuilder.frontend.core.network.EditorEndpoint
import com.dsbuilder.frontend.core.network.HttpMutationResult
import com.dsbuilder.frontend.core.network.MutationHttpMethod
import com.dsbuilder.frontend.core.network.confirmTruncatedMutation
import com.dsbuilder.frontend.core.network.editorCommandJson
import com.dsbuilder.frontend.core.network.editorReadResponse
import com.dsbuilder.frontend.core.network.encodeEditorId
import com.dsbuilder.frontend.feature.components.application.ComponentEditCommand
import com.dsbuilder.frontend.feature.components.application.ComponentEditRemoteSource
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/** Преобразует закрытую типизированную команду по декларативному контракту HTTP. */
internal class HttpComponentEditRemoteSource(
    private val clients: AuthenticatedHttpClientFactory,
) : ComponentEditRemoteSource {
    override suspend fun edit(
        runtime: RuntimeResolution.Resolved,
        command: ComponentEditCommand,
        options: DraftEditOptions,
    ): HttpMutationResult {
        val root = "/api/projects/${runtime.context.projectId.value.encodeEditorId()}" +
            "/design-systems/${runtime.context.designSystemId.value.encodeEditorId()}"
        val encoded = editorCommandJson.encodeToJsonElement<ComponentEditCommand>(command).jsonObject
        val endpoint = endpoints.getValue(encoded.getValue("operation").jsonPrimitive.content)
        val request = endpoint.request(root, encoded, options.idempotencyKey, options.baseRevision)
        val client = clients.create(runtime.apiUrl.value, runtime.credential)
        val response = client.mutate(request)
        return client.confirmTruncatedMutation(response, listOfNotNull(endpoint.confirmation(root, encoded)))
    }

    override suspend fun read(runtime: RuntimeResolution.Resolved, appearanceId: String): HttpMutationResult {
        val root = "/api/projects/${runtime.context.projectId.value.encodeEditorId()}" +
            "/design-systems/${runtime.context.designSystemId.value.encodeEditorId()}"
        return clients.create(runtime.apiUrl.value, runtime.credential).editorReadResponse(
            "$root/appearances/${appearanceId.encodeEditorId()}/editor-model",
        )
    }
}

private val endpoints = mapOf(
    "component_configuration_create" to EditorEndpoint(
        method = MutationHttpMethod.POST,
        path = "/appearances/new",
        confirmationPath = "/appearances",
    ),
    "component_configuration_duplicate" to EditorEndpoint(
        method = MutationHttpMethod.POST,
        path = "/appearances/{appearanceId}/duplicate",
        confirmationPath = "/appearances/{appearanceId}/editor-model",
    ),
    "component_configuration_update" to EditorEndpoint(
        method = MutationHttpMethod.PATCH,
        path = "/appearances/{appearanceId}",
        confirmationPath = "/appearances/{appearanceId}/editor-model",
    ),
    "component_configuration_delete" to EditorEndpoint(
        method = MutationHttpMethod.DELETE,
        path = "/appearances/{appearanceId}",
        sendsBody = false,
        confirmationPath = "/appearances",
    ),
    "component_axis_create" to EditorEndpoint(
        method = MutationHttpMethod.POST,
        path = "/appearances/{appearanceId}/axes",
        bodyField = "input",
        confirmationPath = "/appearances/{appearanceId}/editor-model",
    ),
    "component_axis_update" to EditorEndpoint(
        method = MutationHttpMethod.PATCH,
        path = "/appearance-variations/{axisId}",
        confirmationPath = "/appearance-variations/{axisId}",
    ),
    "component_axis_delete" to EditorEndpoint(
        method = MutationHttpMethod.DELETE,
        path = "/appearances/{appearanceId}/axes/{axisId}",
        sendsBody = false,
        queryFields = listOf("confirmCascade"),
        confirmationPath = "/appearances/{appearanceId}/editor-model",
    ),
    "component_axes_reorder" to EditorEndpoint(
        method = MutationHttpMethod.POST,
        path = "/appearances/{appearanceId}/axis-order",
        confirmationPath = "/appearances/{appearanceId}/editor-model",
    ),
    "component_axis_value_create" to EditorEndpoint(
        method = MutationHttpMethod.POST,
        path = "/appearances/{appearanceId}/axes/{axisId}/values",
        bodyField = "input",
        confirmationPath = "/appearances/{appearanceId}/editor-model",
    ),
    "component_axis_value_update" to EditorEndpoint(
        method = MutationHttpMethod.PATCH,
        path = "/appearance-variation-values/{valueId}",
        confirmationPath = "/appearance-variation-values/{valueId}",
    ),
    "component_axis_value_delete" to EditorEndpoint(
        method = MutationHttpMethod.DELETE,
        path = "/appearances/{appearanceId}/axis-values/{valueId}",
        sendsBody = false,
        queryFields = listOf("confirmCascade"),
        confirmationPath = "/appearances/{appearanceId}/editor-model",
    ),
    "component_axis_values_reorder" to EditorEndpoint(
        method = MutationHttpMethod.PUT,
        path = "/appearances/{appearanceId}/axes/{axisId}/value-order",
        confirmationPath = "/appearances/{appearanceId}/editor-model",
    ),
    "component_property_set" to EditorEndpoint(
        method = MutationHttpMethod.PUT,
        path = "/appearances/{appearanceId}/property-values",
        bodyField = "input",
        confirmationPath = "/appearances/{appearanceId}/editor-model",
    ),
    "component_property_reset" to EditorEndpoint(
        method = MutationHttpMethod.DELETE,
        path = "/appearances/{appearanceId}/property-values",
        sendsBody = false,
        queryFields = listOf("propertyId", "styleIds", "states"),
        confirmationPath = "/appearances/{appearanceId}/editor-model",
    ),
    "component_states_reorder" to EditorEndpoint(
        method = MutationHttpMethod.PUT,
        path = "/appearances/{appearanceId}/state-order",
        bodyField = "input",
        confirmationPath = "/appearances/{appearanceId}/editor-model",
    ),
)
