package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.domain.CoreValueCompatibility
import java.util.UUID

/** Импорт уже разрешил свойства, владельца оформления и состояния по выбранному Core. */
internal fun ComponentConfigImportContext.validateAssignment(property: UUID, tokenId: UUID?, literal: String?) {
    val type = propertyTypes.getValue(property)
    val valid = if (tokenId == null) {
        CoreValueCompatibility.literalFits(type, literal, platform.wireValue)
    } else {
        val row = tokenRows[tokenId]
        row != null && row[ComponentTokensTable.enabled] != false &&
            CoreValueCompatibility.tokenFits(type, row[ComponentTokensTable.type])
    }
    check(valid) { "CORE_VALUE_TYPE_CONFLICT: The value is incompatible with the selected Core" }
}
