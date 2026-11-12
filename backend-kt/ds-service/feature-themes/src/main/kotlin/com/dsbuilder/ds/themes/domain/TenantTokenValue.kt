package com.dsbuilder.ds.themes.domain

import kotlinx.serialization.json.JsonElement
import java.time.Instant
import java.util.UUID

/** Token-value read model local to the themes feature. */
data class TenantTokenValue(
    /** Id carried by this contract. */
    val id: UUID,
    /** Token id carried by this contract. */
    val tokenId: UUID?,
    /** Tenant id carried by this contract. */
    val tenantId: UUID?,
    /** Palette id carried by this contract. */
    val paletteId: UUID?,
    /** Platform carried by this contract. */
    val platform: String?,
    /** Mode carried by this contract. */
    val mode: String?,
    /** Value json carried by this contract. */
    val value: JsonElement?,
    /** Текущая техническая ревизия этого значения в активном черновике. */
    val editRevision: Long,
    /** Created at carried by this contract. */
    val createdAt: Instant,
    /** Updated at carried by this contract. */
    val updatedAt: Instant,
    /** Исходная ссылка на палитру, если [valueJson] вычислен по палитре темы. */
    val paletteRef: String? = null,
    /** Своё значение платформы iOS или Android, а не построенное клиентом из web. */
    val overridden: Boolean = false,
    /** Хранимое значение, если [valueJson] отдаётся в другой форме: со ссылками, раскрытыми в HEX, или слоем. */
    val sourceValue: JsonElement? = null,
    /** Тип токена на выбранной границе версии; задаёт форму сплошных значений платформ. */
    val tokenType: ThemeTokenType? = null,
    /** Имя определения на той же границе для раскрытия палитры без повторного чтения определений. */
    val tokenName: String? = null,
) {
    /** Строковое представление для совместимых внутренних потребителей, вычисляемое только по обращению. */
    val valueJson: String? get() = value?.toString()

    /** Строковое представление исходного значения для совместимых внутренних потребителей. */
    val sourceValueJson: String? get() = sourceValue?.toString()

    /** Возвращает разобранный JSON без преобразований. */
    fun valueElement(): JsonElement? = value

    /** Возвращает исходный JSON без повторного разбора. */
    fun sourceValueElement(): JsonElement? = sourceValue
}
