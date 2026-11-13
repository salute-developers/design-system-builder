package com.dsbuilder.ds.core.application

/** Общий отчёт выбранной границы; фильтрация не меняет глобальные счётчики. */
data class CoreCompatibilityReport(
    /** Фактические Core и предметная граница проверки. */
    val context: ModelReadContext,
    /** Проблемы текущей страницы после фильтрации. */
    val items: List<CoreCompatibilityIssue>,
    /** Общее число блокирующих проблем всей ДС, до фильтрации. */
    val blockingCount: Int,
    /** Общее число предупреждений всей ДС, до фильтрации. */
    val warningCount: Int,
    /** Версия правил проверки, включённая в контекст курсора. */
    val validatorVersion: Int = 1,
    /** Продолжение страницы, связанное с Core, редакцией и фильтром. */
    val nextCursor: String? = null,
)
