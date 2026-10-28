package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.domain.ThemeTokenMode
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.colortokens.ColorValueShape
import com.dsbuilder.ds.themes.domain.colortokens.TokenValueRule
import java.util.UUID

internal const val TENANT_EDIT_CONFLICT = "TENANT_EDIT_CONFLICT"
internal const val TOKEN_NAME_CONFLICT = "TOKEN_NAME_CONFLICT"
internal const val INVALID_TOKEN_NAME = "INVALID_TOKEN_NAME"
internal const val INVALID_TOKEN_FAMILY = "INVALID_TOKEN_FAMILY"
internal const val INVALID_TOKEN_VALUE = "INVALID_TOKEN_VALUE"

/** Все пары платформы и режима, которые должны быть у члена семейства при создании токена. */
internal val REQUIRED_VALUE_KEYS: Set<Pair<ThemeTokenPlatform, ThemeTokenMode>> =
    ThemeTokenPlatform.entries.flatMap { platform -> ThemeTokenMode.entries.map { platform to it } }.toSet()

/** Отказ с кодом [INVALID_TOKEN_NAME]. */
internal fun invalidTokenName(message: String) = DsFailure.InvalidRequest(INVALID_TOKEN_NAME, message = message)

/** Отказ с кодом [INVALID_TOKEN_FAMILY]. */
internal fun invalidTokenFamily(message: String) = DsFailure.InvalidRequest(INVALID_TOKEN_FAMILY, message = message)

/** Отказ с кодом [INVALID_TOKEN_VALUE] и адресом значения `<токен>:<platform>:<mode>`. */
internal fun invalidTokenValue(address: String, message: String) =
    DsFailure.InvalidRequest(INVALID_TOKEN_VALUE, details = mapOf("address" to address), message = message)

/** Проверяет все права [permissions]; первая недостающая даёт отказ. */
internal fun DsAccessPolicy.requireAll(context: DsRequestContext, vararg permissions: String): DsResult<Unit> =
    permissions.map { require(context, it) }.firstOrNull { it is DsResult.Failure } ?: DsResult.Success(Unit)

/** Семейство найденного токена или отказ: `404` — токена нет, `400 INVALID_TOKEN_FAMILY` — токен вне семейств. */
internal fun ColorTokenLookup.storedOrFailure(tokenId: UUID): DsResult<StoredColorTokenFamily> = when (this) {
    is ColorTokenLookup.Found -> DsResult.Success(stored)
    ColorTokenLookup.Missing -> DsResult.Failure(DsFailure.NotFound)
    ColorTokenLookup.OutsideFamily ->
        DsResult.Failure(invalidTokenFamily("Токен $tokenId не является цветовым или градиентным токеном семейства"))
}

/** Отказ блокировки или `null`, если темы заблокированы. */
internal fun ColorTokenLock.failure(): DsFailure? = when (this) {
    is ColorTokenLock.Locked -> null
    ColorTokenLock.NotFound -> DsFailure.NotFound
    is ColorTokenLock.RevisionConflict -> DsFailure.Conflict(TENANT_EDIT_CONFLICT, editRevision = editRevision)
}

/** Есть ли у значений повторяющаяся пара платформы и режима. */
internal fun List<ColorTokenValue>.hasDuplicateKey(): Boolean =
    map { it.platform to it.mode }.let { it.size != it.toSet().size }

/**
 * Правило значений по копии шаблона палитры темы; тема, созданная в обход `ds-service`, получает копию здесь же.
 * Доступ к теме проверен вызывающей операцией; копия создаётся идемпотентно и не конфликтует с параллельной
 * инициализацией той же темы.
 */
internal suspend fun TenantPaletteRepository.valueRule(tenantId: UUID): TokenValueRule {
    val template = template(tenantId).ifEmpty { initialize(tenantId).let { template(tenantId) } }
    return TokenValueRule(template)
}

/** Набор значений члена неполон или содержит повтор пары платформы и режима. */
internal fun List<ColorTokenValue>.isIncomplete(): Boolean =
    hasDuplicateKey() || map { it.platform to it.mode }.toSet() != REQUIRED_VALUE_KEYS

/**
 * Первое недопустимое значение операции цветового токена: цвет или градиент у любого члена семейства, признак
 * `overridden` только у iOS и Android. Ключ [values] — адрес токена в сообщении об ошибке.
 */
internal fun TokenValueRule.firstViolation(values: Map<String, List<ColorTokenValue>>): DsFailure.InvalidRequest? =
    values.firstNotNullOfOrNull { (token, items) ->
        items.firstNotNullOfOrNull { item ->
            val reason = if (item.overridden && item.platform == ThemeTokenPlatform.WEB) {
                "Своё значение задаётся только для ios и android"
            } else {
                validateColorToken(item.platform, item.paletteId != null, item.value)
            }
            reason?.let { invalidTokenValue("$token:${item.platform.wireValue}:${item.mode.wireValue}", it) }
        }
    }

/** Значения в хранимой форме: сплошной слой `color` iOS и Android становится строкой. */
internal fun <K> Map<K, List<ColorTokenValue>>.storedForm(): Map<K, List<ColorTokenValue>> =
    mapValues { (_, items) ->
        items.map { item -> item.copy(value = ColorValueShape.storedForm(item.platform, item.value)) }
    }
