package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.components.domain.PreviewPluginPlatform
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Выдаёт адрес активного билда плагина участнику проекта. Версия дизайн-системы на ответ не влияет. */
class GetActivePluginBuildUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val storages: PluginBuildStorages,
    private val builds: PluginBuildRepository,
) {
    /** Возвращает активный билд [platform] либо `NotFound`, если хранилище платформы не настроено или билда нет. */
    suspend fun execute(platform: PreviewPluginPlatform, context: DsRequestContext): DsResult<ActivePluginBuild> =
        policy.read(context, ProjectScope.COMPONENTS_READ) {
            val binding = storages.configured(platform) ?: return@read DsResult.Failure(DsFailure.NotFound)
            transactions.readOnly {
                builds.active(platform.wire)
                    ?.let { DsResult.Success(ActivePluginBuild(it, binding.settings.pluginUrl(it.buildId))) }
                    ?: DsResult.Failure(DsFailure.NotFound)
            }
        }
}
