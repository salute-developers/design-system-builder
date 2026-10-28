package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenView
import com.dsbuilder.ds.themes.domain.sizetokens.SizeWrittenValue

/** Изменённый токен в формате чтения и записанные значения платформ. */
data class UpdatedSizeToken(
    /** Токен в формате чтения. */
    val token: SizeTokenView,
    /** Значения платформ после записи. */
    val values: List<SizeWrittenValue>,
)
