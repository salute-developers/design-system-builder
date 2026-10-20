package com.dsbuilder.ds.themes.application.sizetokens

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.application.colortokens.INVALID_TOKEN_NAME
import com.dsbuilder.ds.themes.application.colortokens.TOKEN_NAME_CONFLICT
import com.dsbuilder.ds.themes.application.colortokens.requireAll
import com.dsbuilder.ds.themes.domain.sizetokens.SizePlatformValues
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenKind
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenNaming
import com.dsbuilder.ds.themes.domain.sizetokens.SizeTokenValue
import com.dsbuilder.ds.themes.domain.sizetokens.SizeValueCheck
import com.dsbuilder.ds.themes.domain.sizetokens.SizeValueParser
import java.util.UUID

/**
 * Создаёт радиус, отступ или четыре варианта размера тени одной транзакцией: значения пишутся во все темы
 * дизайн-системы с `overridden: false`, ревизии всех тем увеличиваются.
 */
class CreateSizeTokenUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val tokens: SizeTokenRepository,
    private val usage: SizeTokenUsageRepository,
) {
    /** Создание токена [command] в дизайн-системе темы [tenantId]. */
    @Suppress("ReturnCount")
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        command: CreateSizeToken,
    ): DsResult<SizeTokenMutation<CreatedSizeTokens>> {
        val allowed = policy.requireAll(context, ProjectScope.TENANTS_WRITE, ProjectScope.TOKENS_WRITE)
        if (allowed is DsResult.Failure) return allowed
        if (!SizeTokenNaming.validSegment(command.name)) {
            val message = "Имя токена — латиница в нижнем регистре, цифры и дефис"
            return DsResult.Failure(
                DsFailure.InvalidRequest(INVALID_TOKEN_NAME, details = mapOf("field" to "name"), message = message),
            )
        }
        val values = when (val check = values(command)) {
            is SizeValueCheck.Invalid -> return DsResult.Failure(check.violation.toFailure())
            is SizeValueCheck.Valid -> check.value
        }
        return transactions.required {
            when (val lock = tokens.lock(context.projectId, tenantId, command.editRevision, allThemes = true)) {
                is SizeTokenLock.Locked -> create(tenantId, lock, command.kind, values)
                else -> DsResult.Failure(requireNotNull(lock.failure()))
            }
        }
    }

    /** Полное имя → значение: один токен радиуса или отступа, четыре варианта тени в порядке вариантов. */
    private fun values(command: CreateSizeToken): SizeValueCheck<Map<String, SizeTokenValue>> =
        when (command.kind) {
            SizeTokenKind.SHADOW -> when (val check = SizeValueParser.variants(command.value)) {
                is SizeValueCheck.Invalid -> check
                is SizeValueCheck.Valid -> {
                    val byVariant = check.value.associate { it.variant to it.value }
                    SizeValueCheck.Valid(
                        SizeTokenNaming.SHADOW_VARIANTS.associate { variant ->
                            "$variant.${command.name}" to byVariant.getValue(variant)
                        },
                    )
                }
            }
            // Новый радиус и отступ получают одно значение веба: свои значения платформ при создании не задаются.
            else -> when (val check = SizeValueParser.parse(command.kind, command.value.copy(platforms = null))) {
                is SizeValueCheck.Invalid -> check
                is SizeValueCheck.Valid -> {
                    val name = SizeTokenNaming.fullNames(command.kind, command.name).single()
                    SizeValueCheck.Valid(mapOf(name to check.value))
                }
            }
        }

    private suspend fun create(
        tenantId: UUID,
        lock: SizeTokenLock.Locked,
        kind: SizeTokenKind,
        values: Map<String, SizeTokenValue>,
    ): DsResult<SizeTokenMutation<CreatedSizeTokens>> {
        val names = values.keys.toList()
        tokens.takenNames(lock.designSystemId, names).sorted().firstOrNull()?.let { taken ->
            return DsResult.Failure(
                DsFailure.Conflict(TOKEN_NAME_CONFLICT, message = "Токен $taken уже есть в дизайн-системе"),
            )
        }
        val ids = tokens.insert(lock.designSystemId, kind.type, names)
        ids.forEach { (name, id) ->
            tokens.replaceValues(lock.tenantIds, id, SizePlatformValues.write(kind, values.getValue(name)))
        }
        val revision = tokens.bumpRevisions(lock.tenantIds).getValue(tenantId)
        val created = ids.values.toSet()
        val stored = tokens.tokens(lock.designSystemId, tenantId)
            .filter { it.id in created }
            .sortedBy { names.indexOf(it.name) }
        val views = usage.views(lock.designSystemId, stored)
        return DsResult.Success(SizeTokenMutation(revision, CreatedSizeTokens(kind, views)))
    }
}
