package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.CompatibilityChecker
import com.dsbuilder.ds.core.application.CoreCompatibilityReport
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadTarget
import com.dsbuilder.ds.core.application.RequestHash
import com.dsbuilder.ds.core.application.TransactionRunner
import java.util.UUID

/** Доступная участнику сводка с устойчивыми проблемами, глобальными счётчиками и проверяемой страницей. */
class GetCoreCompatibilityUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val checker: CompatibilityChecker,
) {
    /** Запрос одной страницы; курсор связан с Core, редакцией и фильтрами. */
    data class Query(
        /** Устойчивый ID компонента. */
        val componentId: UUID? = null,
        /** blocking запрещает публикацию и экспорт; warning только предупреждает. */
        val severity: String? = null,
        /** Размер страницы от 1 до 200. */
        val limit: Int = 100,
        /** Курсор продолжения с проверкой Core и предметной редакции. */
        val cursor: String? = null,
    )

    /** Проверяет доступ перед чтением каких-либо настроек. */
    suspend fun execute(context: DsRequestContext, query: Query): DsResult<CoreCompatibilityReport> {
        val id = context.designSystemId ?: return DsResult.Failure(DsFailure.InvalidRequest("invalid_query"))
        if (query.limit !in 1..200 || query.severity !in listOf(null, "blocking", "warning")) {
            return DsResult.Failure(DsFailure.InvalidRequest("invalid_query"))
        }
        return policy.read(context, ProjectScope.COMPONENT_VARIATIONS_READ) {
            transactions.readOnly(context, ModelReadTarget(ModelReadTarget.Kind.DESIGN_SYSTEM, id)) { resolved ->
                page(checker.check(resolved.projectId, id, resolved.versionId), query)
            }
        }
    }

    private fun page(report: CoreCompatibilityReport, query: Query): DsResult<CoreCompatibilityReport> {
        val fingerprint = RequestHash.canonical(
            listOf(
                report.context,
                report.validatorVersion,
                query.componentId,
                query.severity,
            ),
        )
        val parts = query.cursor?.split(':')
        if (parts != null && (parts.size != 2 || parts[0] != fingerprint)) {
            return DsResult.Failure(DsFailure.Conflict("CORE_CONTEXT_STALE"))
        }
        val offset = if (parts == null) 0 else parts[1].toIntOrNull()
        if (offset == null || offset < 0) return DsResult.Failure(DsFailure.InvalidRequest("invalid_cursor"))
        val items = report.items.filter {
            (query.componentId == null || it.location.componentId == query.componentId) &&
                (query.severity == null || it.severity == query.severity)
        }
        return DsResult.Success(
            report.copy(
                items = items.drop(offset).take(query.limit),
                nextCursor = if (offset < items.size - query.limit) "$fingerprint:${offset + query.limit}" else null,
            ),
        )
    }
}
