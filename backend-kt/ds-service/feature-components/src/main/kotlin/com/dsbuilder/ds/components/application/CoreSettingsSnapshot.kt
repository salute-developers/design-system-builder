package com.dsbuilder.ds.components.application

import com.dsbuilder.ds.core.application.CoreCompatibilityReport
import com.dsbuilder.ds.core.application.ModelReadContext

/** Настройки и сводка без предметных значений, доступных только через compatibility. */
data class CoreSettingsSnapshot(
    /** Проверенная граница и выбранные Core. */
    val context: ModelReadContext,
    /** Число блокирующих проблем без раскрытия назначений. */
    val blockingCount: Int,
    /** Число предупреждений без раскрытия назначений. */
    val warningCount: Int,
) {
    companion object {
        /** Отбрасывает детали, требующие отдельных прав компонентов. */
        fun from(report: CoreCompatibilityReport) = CoreSettingsSnapshot(
            report.context,
            report.blockingCount,
            report.warningCount,
        )
    }
}
