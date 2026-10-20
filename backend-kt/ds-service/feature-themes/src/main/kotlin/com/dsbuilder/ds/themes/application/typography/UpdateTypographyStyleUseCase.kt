package com.dsbuilder.ds.themes.application.typography

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.typography.StoredTypographyToken
import com.dsbuilder.ds.themes.domain.typography.TypographyPlatformValues
import com.dsbuilder.ds.themes.domain.typography.TypographyStyleBuilder
import com.dsbuilder.ds.themes.domain.typography.TypographyTokenChange
import com.dsbuilder.ds.themes.domain.typography.TypographyTokenName
import com.dsbuilder.ds.themes.domain.typography.TypographyUsage
import com.dsbuilder.ds.themes.domain.typography.TypographyValueRules
import com.dsbuilder.ds.themes.domain.typography.TypographyValueViolation
import java.util.UUID

/**
 * Меняет стиль типографии в текущей теме: размеры — в трёх токенах стиля на экране токена, вес начертания — в
 * токене начертания на всех экранах, семейство — во всех токенах стиля. Значения других тем не меняются.
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
        TypographyValueRules.validate(command.size, command.lineHeight, command.letterSpacing, command.weights)
            ?.let { return DsResult.Failure(invalidTypographyValue(it)) }
        return transactions.required {
            when (val lock = repository.lock(context.projectId, tenantId, command.editRevision)) {
                is TypographyStyleLock.Locked -> update(tenantId, tokenId, lock.designSystemId, command)
                else -> DsResult.Failure(requireNotNull(lock.failure()))
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
        val tokens = repository.styles(designSystemId, tenantId, target.style)
        val written = tokens.mapNotNull { token -> write(token, target, command) }
        repository.writeValues(tenantId, written.associate { it.tokenId to it.values })
        val revision = repository.bumpRevision(tenantId)
        val updated = written.associateBy { it.tokenId }
        val members = tokens
            .filter { it.name.screen == target.screen }
            .map { token -> updated[token.id]?.let { token.copy(values = it.values) } ?: token }
        val components = TypographyUsage.count(usage.references(designSystemId))[target.style].orEmpty()
        return DsResult.Success(
            UpdatedTypographyStyle(
                editRevision = revision,
                style = TypographyStyleBuilder.style(target.screen, target.style, members, components),
                tokens = written,
            ),
        )
    }

    /** Новые значения токена [token] или `null`, если изменение его не касается. */
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
        // Пишутся платформы, значения которых есть у токена: новая строка неполного значения не создаётся.
        val values = token.values.mapValues { (platform, current) ->
            TypographyPlatformValues.write(current, platform, change)
        }
        return WrittenTypographyToken(token.id, token.name.toString(), values)
    }
}
