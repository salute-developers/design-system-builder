package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.UniqueKeyLockRepository
import com.dsbuilder.ds.themes.application.colortokens.INVALID_TOKEN_NAME
import com.dsbuilder.ds.themes.application.colortokens.TOKEN_NAME_CONFLICT
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.typography.StoredTypographyToken
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleKey
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleNaming
import com.dsbuilder.ds.themes.domain.typography.TypographyTokenName
import com.dsbuilder.ds.themes.domain.typography.TypographyVariant
import java.util.UUID

/** Тот же предметный ключ уникальности, что у общего создания токена. */
private const val TOKEN_KEY = "token"

/** Токены стиля после создания, переименования или удаления. */
data class TypographyStyleTokens(
    /** Идентификаторы токенов стиля. */
    val tokenIds: List<UUID>,
)

/** Отказ для размера [size] нового или переименованного стиля группы [group] или `null`, если он допустим. */
internal fun invalidStyleName(group: String, size: String): DsFailure? = when {
    !TypographyStyleNaming.knownGroup(group) ->
        DsFailure.InvalidRequest(
            INVALID_TOKEN_NAME,
            details = mapOf("field" to "group"),
            message = "Группа стиля — Display, Header, Body или Text",
        )
    !TypographyStyleNaming.validSize(size) ->
        DsFailure.InvalidRequest(
            INVALID_TOKEN_NAME,
            details = mapOf("field" to "size"),
            message = "Размер стиля — латиница в нижнем регистре и цифры",
        )
    else -> null
}

/**
 * Блокирует ключи имён девяти токенов стиля [style] в устойчивом порядке и проверяет, что они свободны; токены
 * [except] (переименовываемые) не мешают.
 */
internal suspend fun TypographyStyleRepository.claimStyle(
    uniqueKeys: UniqueKeyLockRepository,
    designSystemId: UUID,
    style: TypographyStyleKey,
    except: Set<String> = emptySet(),
): DsFailure? {
    val names = TypographyStyleNaming.names(style).map { it.toString() }
    names.sorted().forEach { uniqueKeys.lock(designSystemId, TOKEN_KEY, it) }
    val taken = tokenNames(designSystemId) - except
    if (names.none { it in taken }) return null
    return DsFailure.Conflict(TOKEN_NAME_CONFLICT, message = "Стиль $style уже есть в дизайн-системе")
}

/** Стиль токена [tokenId] или отказ: токена нет или он не токен стиля типографии. */
internal suspend fun TypographyStyleRepository.styleOf(
    designSystemId: UUID,
    tokenId: UUID,
): DsResult<TypographyStyleKey> = when (val lookup = token(designSystemId, tokenId)) {
    TypographyTokenLookup.Missing -> DsResult.Failure(DsFailure.NotFound)
    is TypographyTokenLookup.Found -> lookup.takeIf { it.type == ThemeTokenType.TYPOGRAPHY }
        ?.let { TypographyTokenName.parse(it.name) }
        ?.let { DsResult.Success(it.style) }
        ?: DsResult.Failure(invalidTypographyStyle("Токен ${lookup.name} не является токеном стиля типографии"))
}

/**
 * Текстовые ссылки компонентов на начертания стиля [style] по токену, к которому они привязываются (`screen-s`
 * своего начертания): токен → строки значений.
 */
internal suspend fun TypographyUsageRepository.anchoredReferences(
    designSystemId: UUID,
    style: TypographyStyleKey,
    tokens: List<StoredTypographyToken>,
): Map<UUID, Set<UUID>> {
    val texts = TypographyVariant.entries.associateBy { TypographyStyleNaming.reference(style, it) }
    val rows = textReferences(designSystemId, texts.keys)
    return rows.mapNotNull { (text, ids) ->
        val variant = texts.getValue(text)
        val anchor = TypographyStyleNaming.anchor(style, variant)
        // Без токена `screen-s` ссылка привязывается к токену этого начертания на другом экране.
        val token = tokens.firstOrNull { it.name == anchor }
            ?: tokens.firstOrNull { it.name.style == style && it.name.variant == variant }
        token?.let { it.id to ids }
    }.toMap()
}
