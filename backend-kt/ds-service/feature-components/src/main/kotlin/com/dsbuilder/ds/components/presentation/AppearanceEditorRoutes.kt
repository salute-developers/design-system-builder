package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.AddAppearanceAxisUseCase
import com.dsbuilder.ds.components.application.AddAppearanceAxisValueUseCase
import com.dsbuilder.ds.components.application.AppearanceEditorRepository
import com.dsbuilder.ds.components.application.CreateAppearanceConfigurationUseCase
import com.dsbuilder.ds.components.application.DuplicateAppearanceConfigurationUseCase
import com.dsbuilder.ds.components.application.GetAppearanceEditorModelUseCase
import com.dsbuilder.ds.components.application.GetComponentTokenReferencesUseCase
import com.dsbuilder.ds.components.application.GetResolvedComponentPropertiesUseCase
import com.dsbuilder.ds.components.application.RemoveAppearanceAxisUseCase
import com.dsbuilder.ds.components.application.RemoveAppearanceAxisValueUseCase
import com.dsbuilder.ds.components.application.RemoveAppearancePropertyValueUseCase
import com.dsbuilder.ds.components.application.ReorderAppearanceAxesUseCase
import com.dsbuilder.ds.components.application.ReorderAppearanceAxisValuesUseCase
import com.dsbuilder.ds.components.application.ReorderAppearanceStatesUseCase
import com.dsbuilder.ds.components.application.SetAppearancePropertyValueUseCase
import com.dsbuilder.ds.components.domain.Appearance
import com.dsbuilder.ds.components.domain.EditorAxis
import com.dsbuilder.ds.components.domain.EditorAxisValue
import com.dsbuilder.ds.components.domain.EditorPropertyValue
import com.dsbuilder.ds.components.domain.EditorRemoval
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.withIdempotentResponse
import com.dsbuilder.ds.core.presentation.OkResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.modelReadContext
import com.dsbuilder.ds.core.presentation.repeatableMutation
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.core.presentation.respondSuccess
import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingContext
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.put
import io.ktor.server.routing.route
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.serializer
import java.util.UUID

private const val MAX_NAME_LENGTH = 255
private const val IDEMPOTENCY_HEADER = "Idempotency-Key"

/** Операции редактора над оформлением компонента: модель, оси, значения свойств, состояния и конфигурации. */
@Suppress("CyclomaticComplexMethod", "LongMethod", "LongParameterList")
fun Route.appearanceEditorRoutes(
    evaluator: PolicyEvaluator,
    model: GetAppearanceEditorModelUseCase,
    resolvedProperties: GetResolvedComponentPropertiesUseCase,
    tokenReferences: GetComponentTokenReferencesUseCase,
    addAxis: AddAppearanceAxisUseCase,
    removeAxis: RemoveAppearanceAxisUseCase,
    reorderAxes: ReorderAppearanceAxesUseCase,
    addValue: AddAppearanceAxisValueUseCase,
    removeValue: RemoveAppearanceAxisValueUseCase,
    reorderValues: ReorderAppearanceAxisValuesUseCase,
    setPropertyValue: SetAppearancePropertyValueUseCase,
    removePropertyValue: RemoveAppearancePropertyValueUseCase,
    reorderStates: ReorderAppearanceStatesUseCase,
    createConfiguration: CreateAppearanceConfigurationUseCase,
    duplicateConfiguration: DuplicateAppearanceConfigurationUseCase,
    json: Json,
) {
    route("/api/ds/appearances") {
        get("/{id}/editor-model") {
            val context = requestContext(evaluator) ?: return@get
            val id = pathUuid("id") ?: return@get
            when (val result = model.execute(context, id)) {
                is DsResult.Success -> call.respondSuccess(result, AppearanceEditorModelResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}/resolved-properties") {
            val context = call.modelReadContext(evaluator) ?: return@get
            val id = pathUuid("id") ?: return@get
            val valueIds = call.request.queryParameters.getAll("selectedValueId").orEmpty().map { it.toUuidOrNull() }
            if (valueIds.any { it == null }) {
                return@get call.respondFailure(DsFailure.InvalidRequest("invalid_selected_value_id"))
            }
            when (val result = resolvedProperties.execute(context, id, valueIds.filterNotNull())) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    ResolvedComponentPropertiesResponse(
                        id.toString(),
                        valueIds.filterNotNull().map(UUID::toString),
                        result.value.map(EditorPropertyValueResponse::from),
                    ),
                )
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        get("/{id}/token-references") {
            val context = call.modelReadContext(evaluator) ?: return@get
            val id = pathUuid("id") ?: return@get
            val valueIds = call.request.queryParameters.getAll("selectedValueId").orEmpty().map { it.toUuidOrNull() }
            if (valueIds.any { it == null }) {
                return@get call.respondFailure(DsFailure.InvalidRequest("invalid_selected_value_id"))
            }
            when (val result = tokenReferences.execute(context, id, valueIds.filterNotNull())) {
                is DsResult.Success -> call.respondSuccess(
                    result,
                    ComponentTokenReferencesResponse(result.value.map(ComponentTokenReferenceResponse::from)),
                )
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post("/{id}/axes") {
            val context = requestContext(evaluator) ?: return@post
            val id = pathUuid("id") ?: return@post
            val request = requestBody<AddAppearanceAxisRequest>(json) ?: return@post
            if (request.name.isBlank() || request.name.length > MAX_NAME_LENGTH) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = AppearanceEditorRepository.AxisCreate(
                request.name,
                request.values,
                request.position,
                request.defaultValue,
            )
            val createContext = context.withIdempotentResponse { value: EditorAxis ->
                json.encodeToString(EditorAxisResponse.serializer(), EditorAxisResponse.from(value))
            }
            val key = call.request.headers[IDEMPOTENCY_HEADER]
            when (val result = addAxis.execute(createContext, id, command, key)) {
                is DsResult.Success ->
                    call.respondSuccess(result, HttpStatusCode.Created, EditorAxisResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        delete("/{id}/axes/{axisId}") {
            val context = requestContext(evaluator) ?: return@delete
            val id = pathUuid("id") ?: return@delete
            val axisId = pathUuid("axisId") ?: return@delete
            val confirm = call.request.queryParameters["confirmCascade"] == "true"
            val mutation = call.repeatableMutation(context, confirm, json = json) { value: EditorRemoval ->
                EditorRemovalResponse.from(value)
            }
            when (val result = removeAxis.execute(mutation, id, axisId, confirm)) {
                is DsResult.Success -> call.respondSuccess(result, EditorRemovalResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post("/{id}/axis-order") {
            val context = requestContext(evaluator) ?: return@post
            val id = pathUuid("id") ?: return@post
            val request = requestBody<ReorderAppearanceAxesRequest>(json) ?: return@post
            val axisIds = request.axisIds.map { it.toUuidOrNull() }
            if (axisIds.any { it == null }) return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val mutation = call.repeatableMutation(context, request, json = json) { value: List<EditorAxis> ->
                value.map(EditorAxisResponse::from)
            }
            when (val result = reorderAxes.execute(mutation, id, axisIds.filterNotNull())) {
                is DsResult.Success -> call.respondSuccess(result, result.value.map(EditorAxisResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post("/{id}/axes/{axisId}/values") {
            val context = requestContext(evaluator) ?: return@post
            val id = pathUuid("id") ?: return@post
            val axisId = pathUuid("axisId") ?: return@post
            val request = requestBody<AddAppearanceAxisValueRequest>(json) ?: return@post
            if (request.name.isBlank() || request.name.length > MAX_NAME_LENGTH) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = AppearanceEditorRepository.AxisValueCreate(request.name, request.position)
            val createContext = context.withIdempotentResponse { value: EditorAxisValue ->
                json.encodeToString(EditorAxisValueResponse.serializer(), EditorAxisValueResponse.from(value))
            }
            val key = call.request.headers[IDEMPOTENCY_HEADER]
            when (val result = addValue.execute(createContext, id, axisId, command, key)) {
                is DsResult.Success ->
                    call.respondSuccess(result, HttpStatusCode.Created, EditorAxisValueResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        delete("/{id}/axis-values/{valueId}") {
            val context = requestContext(evaluator) ?: return@delete
            val id = pathUuid("id") ?: return@delete
            val valueId = pathUuid("valueId") ?: return@delete
            val confirm = call.request.queryParameters["confirmCascade"] == "true"
            val mutation = call.repeatableMutation(context, confirm, json = json) { value: EditorRemoval ->
                EditorRemovalResponse.from(value)
            }
            when (val result = removeValue.execute(mutation, id, valueId, confirm)) {
                is DsResult.Success -> call.respondSuccess(result, EditorRemovalResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        put("/{id}/axes/{axisId}/value-order") {
            val context = requestContext(evaluator) ?: return@put
            val id = pathUuid("id") ?: return@put
            val axisId = pathUuid("axisId") ?: return@put
            val request = requestBody<ReorderAppearanceAxisValuesRequest>(json) ?: return@put
            val valueIds = request.valueIds.map { it.toUuidOrNull() }
            if (valueIds.any { it == null }) return@put call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val mutation = call.repeatableMutation(context, request, json = json, response = EditorAxisResponse::from)
            when (val result = reorderValues.execute(mutation, id, axisId, valueIds.filterNotNull())) {
                is DsResult.Success -> call.respondSuccess(result, EditorAxisResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        put("/{id}/property-values") {
            val context = requestContext(evaluator) ?: return@put
            val id = pathUuid("id") ?: return@put
            val request = requestBody<SetAppearancePropertyValueRequest>(json) ?: return@put
            val command = request.toCommand()
                ?: return@put call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val mutation = call.repeatableMutation(
                context,
                request,
                json = json,
                response = EditorPropertyValueResponse::from,
            )
            when (val result = setPropertyValue.execute(mutation, id, command)) {
                is DsResult.Success -> call.respondSuccess(result, EditorPropertyValueResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        delete("/{id}/property-values") {
            val context = requestContext(evaluator) ?: return@delete
            val id = pathUuid("id") ?: return@delete
            val query = call.request.queryParameters
            val propertyId = query["propertyId"].toUuidOrNull()
                ?: return@delete call.respondFailure(DsFailure.InvalidRequest("invalid_property_id"))
            val styleIds = query["styleIds"].orEmpty().split(',').filter { it.isNotBlank() }.map { it.toUuidOrNull() }
            if (styleIds.any { it == null }) {
                return@delete call.respondFailure(DsFailure.InvalidRequest("invalid_style_ids"))
            }
            val states = query["states"].orEmpty().split(',').filter { it.isNotBlank() }
            val scope = AppearanceEditorRepository.PropertyValueScope(propertyId, styleIds.filterNotNull(), states)
            val mutation = call.repeatableMutation(context, scope, json = json) { _: Unit -> OkResponse() }
            when (val result = removePropertyValue.execute(mutation, id, scope)) {
                is DsResult.Success -> call.respondSuccess(result, OkResponse())
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        put("/{id}/state-order") {
            val context = requestContext(evaluator) ?: return@put
            val id = pathUuid("id") ?: return@put
            val request = requestBody<ReorderAppearanceStatesRequest>(json) ?: return@put
            val propertyId = request.propertyId.toUuidOrNull()
            val styleIds = request.styleIds.map { it.toUuidOrNull() }
            if (propertyId == null || styleIds.any { it == null }) {
                return@put call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = AppearanceEditorRepository.StateOrder(propertyId, styleIds.filterNotNull(), request.states)
            val mutation = call.repeatableMutation(context, request, json = json) { value: List<EditorPropertyValue> ->
                value.map(EditorPropertyValueResponse::from)
            }
            when (val result = reorderStates.execute(mutation, id, command)) {
                is DsResult.Success -> call.respondSuccess(result, result.value.map(EditorPropertyValueResponse::from))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post("/new") {
            val context = requestContext(evaluator) ?: return@post
            val request = requestBody<CreateAppearanceConfigurationRequest>(json) ?: return@post
            val designSystemId = request.designSystemId.toUuidOrNull()
            val componentId = request.componentId.toUuidOrNull()
            val name = request.name?.trim()?.takeIf { it.isNotEmpty() }
            if (designSystemId == null || componentId == null || (name?.length ?: 0) > MAX_NAME_LENGTH) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = AppearanceEditorRepository.NewAppearance(designSystemId, componentId, name)
            val createContext = context.withAppearanceResponse(json)
            val key = call.request.headers[IDEMPOTENCY_HEADER]
            when (val result = createConfiguration.execute(createContext, command, key)) {
                is DsResult.Success ->
                    call.respondSuccess(result, HttpStatusCode.Created, AppearanceResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
        post("/{id}/duplicate") {
            val context = requestContext(evaluator) ?: return@post
            val id = pathUuid("id") ?: return@post
            val request = requestBody<DuplicateAppearanceConfigurationRequest>(json) ?: return@post
            val name = request.name?.trim()?.takeIf { it.isNotEmpty() }
            if ((name?.length ?: 0) > MAX_NAME_LENGTH) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val createContext = context.withAppearanceResponse(json)
            val key = call.request.headers[IDEMPOTENCY_HEADER]
            when (val result = duplicateConfiguration.execute(createContext, id, name, key)) {
                is DsResult.Success ->
                    call.respondSuccess(result, HttpStatusCode.Created, AppearanceResponse.from(result.value))
                is DsResult.Failure -> call.respondFailure(result.error)
            }
        }
    }
}

private fun DsRequestContext.withAppearanceResponse(json: Json): DsRequestContext =
    withIdempotentResponse { value: Appearance ->
        json.encodeToString(AppearanceResponse.serializer(), AppearanceResponse.from(value))
    }

/** Контекст запроса из доверенных заголовков; при отказе отвечает `403` и возвращает `null`. */
private suspend fun RoutingContext.requestContext(evaluator: PolicyEvaluator): DsRequestContext? {
    val context = TrustedDsRequestContextMapper.map(
        call.request.headers,
        evaluator,
        call.request.queryParameters["versionId"],
    )
    if (context == null) call.respondFailure(DsFailure.Forbidden)
    return context
}

/** Идентификатор из пути; при неверном формате отвечает `400` и возвращает `null`. */
private suspend fun RoutingContext.pathUuid(name: String): UUID? {
    val id = call.parameters[name].toUuidOrNull()
    if (id == null) call.respondFailure(DsFailure.InvalidRequest("invalid_id"))
    return id
}

/** Тело запроса; при ошибке разбора отвечает `400` и возвращает `null`. */
private suspend inline fun <reified T> RoutingContext.requestBody(json: Json): T? {
    val payload = call.receive<JsonObject>()
    val body = runCatching { json.decodeFromJsonElement(serializer<T>(), payload) }.getOrNull()
    if (body == null) call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
    return body
}

@Suppress("ReturnCount")
private fun SetAppearancePropertyValueRequest.toCommand(): AppearanceEditorRepository.PropertyValueSet? {
    val property = propertyId.toUuidOrNull() ?: return null
    val styles = styleIds.map { it.toUuidOrNull() }
    val token = tokenId?.let { it.toUuidOrNull() ?: return null }
    if (styles.any { it == null }) return null
    val referenceInput = reference?.let { input ->
        val target = input.targetAppearanceId.toUuidOrNull() ?: return null
        val referenceStyles = input.styleIds.map { it.toUuidOrNull() }
        if (referenceStyles.any { it == null }) return null
        AppearanceEditorRepository.StyleReferenceInput(target, referenceStyles.filterNotNull())
    }
    return AppearanceEditorRepository.PropertyValueSet(
        AppearanceEditorRepository.PropertyValueScope(property, styles.filterNotNull(), states),
        type,
        token,
        value,
        alpha,
        adjustment,
        referenceInput,
    )
}
