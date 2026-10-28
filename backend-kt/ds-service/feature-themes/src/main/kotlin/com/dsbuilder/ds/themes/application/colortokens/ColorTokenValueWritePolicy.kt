package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TokenValueWrite
import com.dsbuilder.ds.core.application.TokenValueWritePolicy
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.domain.colortokens.ColorValueShape
import kotlinx.serialization.json.JsonElement
import java.util.UUID

/**
 * Правило вида значения для общих маршрутов `token-values`: значение цветового или градиентного токена проверяется
 * как в операциях цветового токена, сплошное значение iOS и Android хранится строкой, а после записи или удаления
 * тип семейства пересчитывается по значениям всех тем. Токен вне семейств проверяется по своему типу.
 */
class ColorTokenValueWritePolicy(
    private val tokens: ColorTokenRepository,
    private val palette: TenantPaletteRepository,
    private val typeSync: ColorTokenFamilyTypeSync = ColorTokenFamilyTypeSync(tokens),
) : TokenValueWritePolicy {
    @Suppress("ReturnCount")
    override suspend fun prepare(write: TokenValueWrite): DsResult<JsonElement?> {
        if (colorType(write.tokenId) == null) return DsResult.Success(write.value)
        val platform = ThemeTokenPlatform.fromWire(write.platform) ?: return DsResult.Success(write.value)
        val designSystemId = tokens.designSystemOf(write.tokenId) ?: return DsResult.Success(write.value)
        // Определения блокируются до выбора проверки по семейству и всегда, даже для пустого значения: иначе
        // конкурентное переименование могло бы вывести токен из семейства или ввести в него между чтением и записью,
        // а создание значения брало бы ключ уникальности раньше определений. Блокируется и сам токен, поэтому после
        // повторного чтения под блокировкой его членство в семействе не меняется до конца транзакции.
        val candidates = tokens.familyInDraft(designSystemId, write.tokenId)?.members?.values ?: listOf(write.tokenId)
        if (!tokens.lockFamilyDefinitions(designSystemId, candidates)) return DsResult.Failure(DsFailure.NotFound)
        val value = write.value ?: return DsResult.Success(null)
        val type = colorType(write.tokenId) ?: return DsResult.Success(value)
        // Принадлежность токена и темы проекту проверена до правил записи, поэтому тема без копии шаблона палитры
        // (созданная в обход `ds-service`) получает её здесь же, как в операциях цветового токена.
        val rule = palette.valueRule(write.tenantId)
        val reason = if (tokens.familyInDraft(designSystemId, write.tokenId) != null) {
            rule.validateColorToken(platform, write.hasPaletteId, value)
        } else {
            rule.validate(type, platform, write.hasPaletteId, value)
        }
        reason?.let { return DsResult.Failure(invalidTokenValue("${write.tokenId}:${write.platform}", it)) }
        return DsResult.Success(ColorValueShape.storedForm(platform, value))
    }

    override suspend fun afterWrite(tokenId: UUID) {
        // Значения не цветовых токенов на тип семейств не влияют: их не нужно ни искать, ни блокировать.
        if (colorType(tokenId) == null) return
        val designSystemId = tokens.designSystemOf(tokenId) ?: return
        typeSync.sync(designSystemId, tokenId)
    }

    /** Тип `color` или `gradient` токена [tokenId] или `null` для других типов и отсутствующего токена. */
    private suspend fun colorType(tokenId: UUID): ThemeTokenType? =
        tokens.tokenTypes(listOf(tokenId))[tokenId]?.takeIf { it in ColorTokenFamily.TYPES }
}
