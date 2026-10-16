package com.dsbuilder.ds.themes.application.tokengroups

import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenLock
import com.dsbuilder.ds.themes.application.colortokens.ColorTokenRepository
import com.dsbuilder.ds.themes.application.colortokens.PlacedToken
import com.dsbuilder.ds.themes.application.colortokens.TOKEN_NAME_CONFLICT
import com.dsbuilder.ds.themes.application.colortokens.failure
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import java.util.UUID

/** Блокирует все темы дизайн-системы темы [tenantId], сверяет ревизию и выполняет [block]. */
internal suspend fun <T> ColorTokenRepository.withAllThemes(
    context: DsRequestContext,
    tenantId: UUID,
    editRevision: Int,
    block: suspend (ColorTokenLock.Locked) -> DsResult<T>,
): DsResult<T> = when (val lock = lock(context.projectId, tenantId, editRevision, allThemes = true)) {
    is ColorTokenLock.Locked -> block(lock)
    else -> DsResult.Failure(requireNotNull(lock.failure()))
}

/**
 * Переименовывает определения [tokens] по правилу [newName] с сохранением идентификаторов. Отказ: `400`, если новое
 * имя не образует семейство (контекст не подходит группе), `409 TOKEN_NAME_CONFLICT`, если имя занято.
 */
@Suppress("ReturnCount")
internal suspend fun ColorTokenRepository.renameAll(
    designSystemId: UUID,
    tokens: List<PlacedToken>,
    newName: (PlacedToken) -> String,
): DsFailure? {
    val changed = tokens.mapNotNull { token -> newName(token).takeIf { it != token.name }?.let { token to it } }
    if (changed.isEmpty()) return null
    val unfit = changed.firstOrNull { (token, name) -> token.type?.let { ColorTokenFamily.of(it, name) } == null }
    unfit?.let { (_, name) ->
        return invalidTokenGroup("Токен $name не подходит группе: у неё другие контексты")
    }
    takenNames(designSystemId, changed.map { it.second }).sorted().firstOrNull()?.let { taken ->
        return DsFailure.Conflict(TOKEN_NAME_CONFLICT, message = "Токен $taken уже есть в дизайн-системе")
    }
    rename(changed.associate { (token, name) -> token.id to name })
    return null
}
