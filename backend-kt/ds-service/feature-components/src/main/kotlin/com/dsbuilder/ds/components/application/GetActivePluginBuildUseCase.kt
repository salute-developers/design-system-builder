package com.dsbuilder.ds.components.application

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Выдаёт адрес активного билда плагина участнику проекта. Версия дизайн-системы на ответ не влияет. */
class GetActivePluginBuildUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val storage: PluginBuildStorage,
    private val builds: PluginBuildRepository,
    private val settings: PluginBuildSettings,
) {
    /** Возвращает активный билд платформы `compose` либо `NotFound`. */
    suspend fun execute(context: DsRequestContext): DsResult<ActivePluginBuild> =
        policy.read(context, ProjectScope.COMPONENTS_READ) {
            if (!storage.configured) return@read DsResult.Failure(DsFailure.NotFound)
            transactions.readOnly {
                builds.active(PublishPluginBuildUseCase.PLATFORM)
                    ?.let { DsResult.Success(ActivePluginBuild(it, settings.pluginUrl(it.buildId))) }
                    ?: DsResult.Failure(DsFailure.NotFound)
            }
        }
}
