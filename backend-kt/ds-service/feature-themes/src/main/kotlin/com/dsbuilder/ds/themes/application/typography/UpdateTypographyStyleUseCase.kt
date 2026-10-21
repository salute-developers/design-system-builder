package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.typography.StoredTypographyToken
import com.dsbuilder.ds.themes.domain.typography.TypographyPlatformValues
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleBuilder
import com.dsbuilder.ds.themes.domain.typography.TypographyTokenChange
import com.dsbuilder.ds.themes.domain.typography.TypographyTokenName
import com.dsbuilder.ds.themes.domain.typography.TypographyUsage
import com.dsbuilder.ds.themes.domain.typography.TypographyValueRules
import com.dsbuilder.ds.themes.domain.typography.TypographyValueViolation
import kotlinx.serialization.json.JsonElement
import java.util.UUID

/**
 * Меняет стиль типографии в текущей теме активного черновика: размеры — в трёх токенах стиля на экране токена, вес
 * начертания — в токене начертания на всех экранах, семейство — во всех токенах стиля. Каждое изменённое значение
 * получает собственную предметную редакцию; значения других тем не меняются.
 */
class UpdateTypographyStyleUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val repository: TypographyStyleRepository,
    private val usage: TypographyUsageRepository,
) {
    /** Изменение стиля токена [tokenId] в теме [tenantId]. */
    @Suppress("ReturnCount")
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        tokenId: UUID,
        command: UpdateTypographyStyle,
    ): DsResult<UpdatedTypographyStyle> {
        val allowed = policy.require(context, ProjectScope.TENANTS_WRITE)
        if (allowed is DsResult.Failure) return allowed
        if (command.isEmpty) {
            return DsResult.Failure(DsFailure.InvalidRequest("invalid_body", message = "Нет изменений стиля"))
        }
        if (command.baseRevisions.any { it.baseRevision < 0 }) {
            return DsResult.Failure(DsFailure.InvalidRequest("invalid_base_revision"))
        }
        TypographyValueRules.validate(command.size, command.lineHeight, command.letterSpacing, command.weights)
            ?.let { return DsResult.Failure(invalidTypographyValue(it)) }
        return transactions.required(context) {
            when (val lock = repository.lock(context.projectId, tenantId)) {
                is TypographyStyleLock.Locked -> update(tenantId, tokenId, lock.designSystemId, command)
                TypographyStyleLock.NotFound -> DsResult.Failure(DsFailure.NotFound)
            }
        }
    }

    @Suppress("ReturnCount")
    private suspend fun update(
        tenantId: UUID,
        tokenId: UUID,
        designSystemId: UUID,
        command: UpdateTypographyStyle,
    ): DsResult<UpdatedTypographyStyle> {
        val target = when (val lookup = repository.token(designSystemId, tokenId)) {
            TypographyTokenLookup.Missing -> return DsResult.Failure(DsFailure.NotFound)
            is TypographyTokenLookup.Found -> lookup.takeIf { it.type == ThemeTokenType.TYPOGRAPHY }
                ?.let { TypographyTokenName.parse(it.name) }
                ?: return DsResult.Failure(
                    invalidTypographyStyle("Токен ${lookup.name} не является токеном стиля типографии"),
                )
        }
        command.fontFamily?.let { family ->
            if (repository.families(designSystemId, tenantId).none { it.name == family }) {
                val violation = TypographyValueViolation("fontFamily", TypographyValueRules.FONT_FAMILY_MESSAGE)
                return DsResult.Failure(invalidTypographyValue(violation))
            }
        }
        // Значения перечитываются под блокировкой: параллельная правка другого поля того же значения не теряется.
        val tokens = repository.lockStyle(designSystemId, tenantId, target.style)
        val bases = command.baseRevisions.associate { (it.tokenId to it.platform) to it.baseRevision }
        val written = tokens.mapNotNull { token -> write(token, target, command) }
        repository.writeValues(
            designSystemId,
            written.flatMap { token ->
                val stored = tokens.first { it.id == token.tokenId }
                token.values.mapNotNull { (platform, value) ->
                    stored.revisions.firstOrNull { it.platform == platform }?.let { revision ->
                        TypographyValueWrite(revision.valueId, value, bases[token.tokenId to platform])
                    }
                }
            },
        )
        // Стиль ответа перечитывается после записи: значения и технические редакции — уже записанные.
        val members = repository.styles(designSystemId, tenantId, target.style)
            .filter { it.name.screen == target.screen }
        val components = TypographyUsage.count(usage.references(designSystemId))[target.style].orEmpty()
        return DsResult.Success(
            UpdatedTypographyStyle(
                style = TypographyStyleBuilder.style(target.screen, target.style, members, components),
                tokens = written,
            ),
        )
    }

    /** Изменённые значения токена [token] или `null`, если изменение его не касается или ничего не меняет. */
    private fun write(
        token: StoredTypographyToken,
        target: TypographyTokenName,
        command: UpdateTypographyStyle,
    ): WrittenTypographyToken? {
        val sameScreen = token.name.screen == target.screen
        val change = TypographyTokenChange(
            sizePx = command.size.takeIf { sameScreen },
            lineHeightPx = command.lineHeight.takeIf { sameScreen },
            letterSpacingEm = command.letterSpacing.takeIf { sameScreen },
            weight = command.weights[token.name.variant],
            fontFamily = command.fontFamily,
        )
        if (change.isEmpty) return null
        // Пишутся платформы, значения которых есть у токена: новая строка неполного значения не создаётся, а
        // значение, которое после перевода не изменилось, не получает лишней редакции.
        val values: Map<ThemeTokenPlatform, JsonElement> = token.values
            .mapValues { (platform, current) -> TypographyPlatformValues.write(current, platform, change) }
            .filter { (platform, value) -> value != token.values[platform] }
        return values.takeIf { it.isNotEmpty() }?.let { WrittenTypographyToken(token.id, token.name.toString(), it) }
    }
}
