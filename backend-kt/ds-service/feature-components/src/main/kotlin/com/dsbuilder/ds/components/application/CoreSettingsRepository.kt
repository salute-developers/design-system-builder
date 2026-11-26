package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.domain.CoreReleaseSnapshot

/** Доступ к конкретным версиям каталога и привязкам платформ черновика. */
interface CoreSettingsRepository {
    /** Возвращает доступные релизы выбранной платформы/канала с устойчивой страницей. */
    suspend fun releases(platform: String, channel: String, offset: Int, limit: Int): List<CoreReleaseSnapshot>

    /** Сохраняет пару платформы и релиза после проверки владельца и ожидаемой ревизии. */
    suspend fun select(context: DsRequestContext, command: SelectCoreRelease): DsResult<Unit>
}
