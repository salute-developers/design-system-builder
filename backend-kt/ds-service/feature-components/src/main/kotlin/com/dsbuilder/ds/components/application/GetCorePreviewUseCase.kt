package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.PreviewPluginPlatform
import com.dsbuilder.ds.core.application.CoreContextResolver
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.ModelReadTarget
import com.dsbuilder.ds.core.application.TransactionRunner

/** Разрешает preview после проверки DS/version; отсутствие сборки не закрывает редактор. */
class GetCorePreviewUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val storages: PluginBuildStorages,
    private val builds: PluginBuildRepository,
    private val cores: CoreContextResolver,
) {
    /** Возвращает только совместимую сборку выбранной границы. */
    suspend fun execute(platform: PreviewPluginPlatform, context: DsRequestContext): DsResult<CorePreviewSelection> {
        val id = context.designSystemId ?: return DsResult.Failure(DsFailure.InvalidRequest("invalid_query"))
        return policy.read(context, ProjectScope.COMPONENTS_READ) {
            transactions.readOnly(context, ModelReadTarget(ModelReadTarget.Kind.DESIGN_SYSTEM, id)) { resolved ->
                val storage = storages.configured(platform) ?: return@readOnly DsResult.Failure(DsFailure.NotFound)
                val core = cores.resolve(resolved.versionId).find { it.ref.platform == platform.wire }
                    ?: return@readOnly DsResult.Failure(DsFailure.NotFound)
                val build = builds.selected(platform.wire, resolved.versionId)
                    ?: return@readOnly DsResult.Failure(DsFailure.NotFound)
                DsResult.Success(
                    CorePreviewSelection(
                        ActivePluginBuild(
                            build,
                            storage.settings.pluginUrl(build.buildId),
                        ),
                        core,
                    ),
                )
            }
        }
    }
}
