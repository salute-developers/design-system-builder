package com.dsbuilder.frontend.feature.ds.application

import kotlinx.serialization.json.JsonElement

/** Результат чтения или безопасный отказ без транспортных подробностей. */
public sealed interface ModelReadResult {
    /** Предметный результат с фактическими метаданными.
     * @property value Данные и метаданные чтения.
     */
    public data class Success(public val value: JsonElement) : ModelReadResult

    /** Код и безопасное пояснение отказа.
     * @property code Машинный код отказа.
     * @property message Безопасное пояснение без credentials.
     */
    public data class Failed(public val code: String, public val message: String) : ModelReadResult
}
