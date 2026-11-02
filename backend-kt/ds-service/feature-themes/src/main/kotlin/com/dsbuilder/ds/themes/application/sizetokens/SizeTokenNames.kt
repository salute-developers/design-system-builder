package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import com.dsbuilder.ds.themes.application.colortokens.INVALID_TOKEN_NAME
import com.dsbuilder.ds.themes.application.colortokens.TOKEN_NAME_CONFLICT
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenKind
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenNaming
import java.util.UUID

/** Тот же предметный ключ уникальности, что у общего создания токена. */
private const val TOKEN_KEY = "token"

/** Ключ имени переменной тени в пакете: `down.soft.m` и `down-soft-m` блокируют разные ключи имени. */
private const val SHADOW_VARIABLE_KEY = "shadow-variable"

/** Отказ для имени [name] нового или переименованного токена раздела [kind] или `null`, если имя допустимо. */
internal fun invalidName(kind: SizeTokenKind, name: String): DsFailure? {
    if (SizeTokenNaming.validName(kind, name)) return null
    val message = if (kind == SizeTokenKind.SHADOW) {
        "Имя тени — латиница в нижнем регистре, цифры и дефис, части имени через точку"
    } else {
        "Имя токена — латиница в нижнем регистре, цифры и дефис"
    }
    return DsFailure.InvalidRequest(INVALID_TOKEN_NAME, details = mapOf("field" to "name"), message = message)
}

/**
 * Блокирует ключи полного имени [name] раздела [kind] и проверяет, что имя свободно в дизайн-системе: нет токена с
 * тем же именем, а у теней — и тени с той же переменной пакета. Токен [except] (переименовываемый) не мешает.
 */
internal suspend fun SizeTokenRepository.claimName(
    uniqueKeys: UniqueKeyLockRepository,
    designSystemId: UUID,
    tenantId: UUID,
    kind: SizeTokenKind,
    name: String,
    except: UUID? = null,
): DsFailure? {
    // Ключи в едином порядке, как у общего создания токена: параллельные запросы одного имени идут подряд.
    uniqueKeys.lock(designSystemId, TOKEN_KEY, name.trim().lowercase())
    if (kind == SizeTokenKind.SHADOW) {
        uniqueKeys.lock(designSystemId, SHADOW_VARIABLE_KEY, SizeTokenNaming.variableKey(name))
    }
    val variable = SizeTokenNaming.variableKey(name)
    val taken = tokens(designSystemId, tenantId).firstOrNull { token ->
        val sameVariable = kind == SizeTokenKind.SHADOW && token.kind == SizeTokenKind.SHADOW &&
            SizeTokenNaming.variableKey(token.name) == variable
        token.id != except && (token.name.trim().equals(name, ignoreCase = true) || sameVariable)
    }?.name
    return taken?.let { DsFailure.Conflict(TOKEN_NAME_CONFLICT, message = "Токен $it уже есть в дизайн-системе") }
}
