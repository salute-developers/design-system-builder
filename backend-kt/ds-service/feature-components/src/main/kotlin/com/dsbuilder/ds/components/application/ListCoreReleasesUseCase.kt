package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadTarget
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.core.domain.CoreReleaseSnapshot

/** Каталог конкретных Core-релизов доступной ДС. */
class ListCoreReleasesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: CoreSettingsRepository,
) {
    /** Каталог фильтруется по платформе и явному каналу, latest не подставляется. */
    suspend fun execute(
        context: DsRequestContext,
        platform: String,
        channel: String,
        offset: Int,
        limit: Int,
    ): DsResult<List<CoreReleaseSnapshot>> {
        val id = context.designSystemId ?: return DsResult.Failure(DsFailure.NotFound)
        if (!valid(platform, channel) || offset < 0 || limit !in 1..200) {
            return DsResult.Failure(DsFailure.InvalidRequest("invalid_query"))
        }
        return policy.read(context, "design-systems:read") {
            transactions.readOnly(context, ModelReadTarget(ModelReadTarget.Kind.DESIGN_SYSTEM, id)) {
                DsResult.Success(repository.releases(platform, channel, offset, limit))
            }
        }
    }

    private fun valid(platform: String, channel: String): Boolean =
        platform in setOf("compose", "web", "xml", "ios") && channel in setOf("stable", "dev")
}
