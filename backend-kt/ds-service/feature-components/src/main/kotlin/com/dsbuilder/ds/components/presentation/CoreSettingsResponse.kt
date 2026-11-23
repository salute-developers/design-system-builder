package com.dsbuilder.ds.components.presentation

import com.dsbuilder.ds.components.application.CoreSettingsSnapshot
import kotlinx.serialization.Serializable

/** Ответ прав настроек не раскрывает предметные значения и адреса конфликтов. */
@Serializable
data class CoreSettingsResponse(
    /** Выбранные Core и ревизия настройки. */
    val context: CoreCompatibilityResponse.Context,
    /** Число блокирующих проблем. */
    val blockingCount: Int,
    /** Число предупреждений. */
    val warningCount: Int,
) {
    companion object {
        /** Создаёт краткую сводку, подробности читаются с правами compatibility. */
        fun from(settings: CoreSettingsSnapshot) = CoreSettingsResponse(
            CoreCompatibilityResponse.context(settings.context),
            settings.blockingCount,
            settings.warningCount,
        )
    }
}
