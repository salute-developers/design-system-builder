package com.dsbuilder.ds.components.data

import com.dsbuilder.ds.components.application.PropertyValueRepository
import java.util.UUID

/** Вычисленное назначение: проверка Core и запись редакции используют одни и те же поля patch. */
internal data class PatchedPropertyValue(
    val tokenId: UUID?,
    val literal: String?,
    val alpha: String?,
    val adjustment: String?,
    val stateSetId: UUID,
) {
    /** Токен хранится отдельно от литерала, как и в исходном контракте записи. */
    val storedLiteral: String? get() = literal.takeIf { tokenId == null }

    /** Пропущенное поле оставляет прежнее значение; явный null очищает его. */
    fun apply(command: PropertyValueRepository.ValueUpdate?): PatchedPropertyValue = PatchedPropertyValue(
        tokenId = if (command?.tokenIdPresent == true) command.tokenId else tokenId,
        literal = if (command?.valuePresent == true) command.value else literal,
        alpha = if (command?.alphaPresent == true) command.alpha else alpha,
        adjustment = if (command?.adjustmentPresent == true) command.adjustment else adjustment,
        stateSetId = command?.stateSetId ?: stateSetId,
    )
}
