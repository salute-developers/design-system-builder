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
import com.dsbuilder.ds.core.application.withIdempotentResponse
import com.dsbuilder.ds.core.presentation.OkResponse
import com.dsbuilder.ds.core.presentation.TrustedDsRequestContextMapper
import com.dsbuilder.ds.core.presentation.dsRoutePath
import com.dsbuilder.ds.core.presentation.dsTrustedHeaders
import com.dsbuilder.ds.core.presentation.modelReadContext
import com.dsbuilder.ds.core.presentation.repeatableMutation
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.core.presentation.respondResult
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
    route(dsRoutePath("/api/design-systems/{designSystemId}/appearances")) {
        get("/{id}/editor-model") {
            val context = requestContext(evaluator) ?: return@get
            val id = pathUuid("id") ?: return@get
            call.respondResult(model.execute(context, id), transform = AppearanceEditorModelResponse::from)
        }
        get("/{id}/resolved-properties") {
            val context = call.modelReadContext(evaluator) ?: return@get
            val id = pathUuid("id") ?: return@get
            val valueIds = call.request.queryParameters.getAll("selectedValueId").orEmpty().map { it.toUuidOrNull() }
            if (valueIds.any { it == null }) {
                return@get call.respondFailure(DsFailure.InvalidRequest("invalid_selected_value_id"))
            }
            call.respondResult(resolvedProperties.execute(context, id, valueIds.filterNotNull())) { value ->
                ResolvedComponentPropertiesResponse(
                    id.toString(),
                    valueIds.filterNotNull().map(UUID::toString),
                    value.map(EditorPropertyValueResponse::from),
                )
            }
        }
        get("/{id}/token-references") {
            val context = call.modelReadContext(evaluator) ?: return@get
            val id = pathUuid("id") ?: return@get
            val valueIds = call.request.queryParameters.getAll("selectedValueId").orEmpty().map { it.toUuidOrNull() }
            if (valueIds.any { it == null }) {
                return@get call.respondFailure(DsFailure.InvalidRequest("invalid_selected_value_id"))
            }
            call.respondResult(tokenReferences.execute(context, id, valueIds.filterNotNull())) { value ->
                ComponentTokenReferencesResponse(value.map(ComponentTokenReferenceResponse::from))
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
            val key = call.dsTrustedHeaders()[IDEMPOTENCY_HEADER]
            call.respondResult(
                addAxis.execute(createContext, id, command, key),
                HttpStatusCode.Created,
                transform = EditorAxisResponse::from,
            )
        }
        delete("/{id}/axes/{axisId}") {
            val context = requestContext(evaluator) ?: return@delete
            val id = pathUuid("id") ?: return@delete
            val axisId = pathUuid("axisId") ?: return@delete
            val confirm = call.request.queryParameters["confirmCascade"] == "true"
            val mutation = call.repeatableMutation(context, confirm, json = json) { value: EditorRemoval ->
                EditorRemovalResponse.from(value)
            }
            call.respondResult(
                removeAxis.execute(mutation, id, axisId, confirm),
                transform = EditorRemovalResponse::from,
            )
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
            call.respondResult(reorderAxes.execute(mutation, id, axisIds.filterNotNull())) { value ->
                value.map(EditorAxisResponse::from)
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
            val key = call.dsTrustedHeaders()[IDEMPOTENCY_HEADER]
            call.respondResult(
                addValue.execute(createContext, id, axisId, command, key),
                HttpStatusCode.Created,
                transform = EditorAxisValueResponse::from,
            )
        }
        delete("/{id}/axis-values/{valueId}") {
            val context = requestContext(evaluator) ?: return@delete
            val id = pathUuid("id") ?: return@delete
            val valueId = pathUuid("valueId") ?: return@delete
            val confirm = call.request.queryParameters["confirmCascade"] == "true"
            val mutation = call.repeatableMutation(context, confirm, json = json) { value: EditorRemoval ->
                EditorRemovalResponse.from(value)
            }
            call.respondResult(
                removeValue.execute(mutation, id, valueId, confirm),
                transform = EditorRemovalResponse::from,
            )
        }
        put("/{id}/axes/{axisId}/value-order") {
            val context = requestContext(evaluator) ?: return@put
            val id = pathUuid("id") ?: return@put
            val axisId = pathUuid("axisId") ?: return@put
            val request = requestBody<ReorderAppearanceAxisValuesRequest>(json) ?: return@put
            val valueIds = request.valueIds.map { it.toUuidOrNull() }
            if (valueIds.any { it == null }) return@put call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            val mutation = call.repeatableMutation(context, request, json = json, response = EditorAxisResponse::from)
            call.respondResult(
                reorderValues.execute(mutation, id, axisId, valueIds.filterNotNull()),
                transform = EditorAxisResponse::from,
            )
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
            call.respondResult(
                setPropertyValue.execute(mutation, id, command),
                transform = EditorPropertyValueResponse::from,
            )
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
            call.respondResult(removePropertyValue.execute(mutation, id, scope)) { value ->
                OkResponse()
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
            call.respondResult(reorderStates.execute(mutation, id, command)) { value ->
                value.map(EditorPropertyValueResponse::from)
            }
        }
        post("/new") {
            val context = requestContext(evaluator) ?: return@post
            val request = requestBody<CreateAppearanceConfigurationRequest>(json) ?: return@post
            val designSystemId = context.designSystemId
            val componentId = request.componentId.toUuidOrNull()
            val name = request.name?.trim()?.takeIf { it.isNotEmpty() }
            if (designSystemId == null || componentId == null || (name?.length ?: 0) > MAX_NAME_LENGTH) {
                return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
            }
            val command = AppearanceEditorRepository.NewAppearance(designSystemId, componentId, name)
            val createContext = context.withAppearanceResponse(json)
            val key = call.dsTrustedHeaders()[IDEMPOTENCY_HEADER]
            call.respondResult(
                createConfiguration.execute(createContext, command, key),
                HttpStatusCode.Created,
                transform = AppearanceResponse::from,
            )
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
            val key = call.dsTrustedHeaders()[IDEMPOTENCY_HEADER]
            call.respondResult(
                duplicateConfiguration.execute(createContext, id, name, key),
                HttpStatusCode.Created,
                transform = AppearanceResponse::from,
            )
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
        call.dsTrustedHeaders(),
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

/** Команда записи свойства; неверные UUID в области или ссылке дают null. */
@Suppress("ReturnCount")
fun SetAppearancePropertyValueRequest.toCommand(): AppearanceEditorRepository.PropertyValueSet? {
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
