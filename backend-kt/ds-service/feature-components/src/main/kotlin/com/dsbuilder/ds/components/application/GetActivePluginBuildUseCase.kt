package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.components.domain.PreviewPluginPlatform
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner

/** Выдаёт общедоступный дескриптор окружения, не заменяющий preview конкретной ДС. */
class GetActivePluginBuildUseCase(
    private val transactions: TransactionRunner,
    private val storages: PluginBuildStorages,
    private val builds: PluginBuildRepository,
) {
    /** Возвращает активный билд [platform] либо NotFound для ненастроенного хранилища или отсутствующего билда. */
    suspend fun execute(platform: PreviewPluginPlatform): DsResult<ActivePluginBuild> {
        val binding = storages.configured(platform) ?: return DsResult.Failure(DsFailure.NotFound)
        return transactions.readOnly {
            builds.active(platform.wire)
                ?.let { DsResult.Success(ActivePluginBuild(it, binding.settings.pluginUrl(it.storageKey))) }
                ?: DsResult.Failure(DsFailure.NotFound)
        }
    }
}
