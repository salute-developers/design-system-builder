package com.dsbuilder.ds.themes.domain

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
    val valueJson: String?,
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
    val sourceValueJson: String? = null,
    /** Тип токена на выбранной границе версии; задаёт форму сплошных значений платформ. */
    val tokenType: ThemeTokenType? = null,
)
