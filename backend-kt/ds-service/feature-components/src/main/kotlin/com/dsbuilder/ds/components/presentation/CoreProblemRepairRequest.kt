package com.dsbuilder.ds.components.presentation

import com.dsbuilder.authorization.PolicyEvaluator
import com.dsbuilder.ds.components.application.RepairCoreProblem
import com.dsbuilder.ds.components.application.RepairCoreProblemUseCase
import com.dsbuilder.ds.components.domain.EditorValueKind
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.presentation.OkResponse
import com.dsbuilder.ds.core.presentation.dsRoutePath
import com.dsbuilder.ds.core.presentation.modelReadContext
import com.dsbuilder.ds.core.presentation.repeatableMutation
import com.dsbuilder.ds.core.presentation.respondFailure
import com.dsbuilder.ds.core.presentation.respondSuccess
import io.ktor.server.request.receive
import io.ktor.server.routing.Route
import io.ktor.server.routing.post
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.util.UUID

/** Явный адрес сохранённого значения; перенос никогда не выбирает цель автоматически. */
@Serializable
data class CoreProblemRepairRequest(
    /** ID оформления; отсутствует у проблемы компонента целиком. */
    val appearanceId: String,
    /** Область назначения: invariant, variation или combination. */
    val valueKind: String,
    /** ID сохранённого назначения для исправления. */
    val valueId: String,
    /** Ожидаемая предметная ревизия исходного назначения. */
    val expectedRevision: Long,
    /** Явно выбранное свойство для переноса; null означает удаление. */
    val targetPropertyId: String? = null,
) {
    /** Разбирает UUID и закрытый словарь видов назначения. */
    fun toCommand(): RepairCoreProblem? = runCatching {
        RepairCoreProblem(
            UUID.fromString(appearanceId),
            EditorValueKind.valueOf(valueKind.uppercase()),
            UUID.fromString(valueId),
            expectedRevision,
            targetPropertyId?.let(UUID::fromString),
        )
    }.getOrNull()
}

/** Исправления сохраняют существующие ключи повторяемости, согласование правок и журнал. */
fun Route.coreProblemRepairRoutes(evaluator: PolicyEvaluator, useCase: RepairCoreProblemUseCase, json: Json) {
    post(dsRoutePath("/api/design-systems/{designSystemId}/compatibility/repair")) {
        val context = call.modelReadContext(evaluator) ?: return@post
        val request = call.receive<CoreProblemRepairRequest>()
        val command = request.toCommand() ?: return@post call.respondFailure(DsFailure.InvalidRequest("invalid_body"))
        val mutation = call.repeatableMutation(context, request, json = json) { _: Unit -> OkResponse() }
        when (val result = useCase.execute(mutation, command)) {
            is DsResult.Failure -> call.respondFailure(result.error)
            is DsResult.Success -> call.respondSuccess(result, OkResponse())
        }
    }
}
