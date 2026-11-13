package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import java.util.UUID

/**
 * Заменяет значения переданных членов семейства цветового токена только в текущей теме и в той же транзакции
 * вычисляет тип семейства по значениям всех тем; значения других тем не переписываются.
 */
class UpdateColorTokenValuesUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val tokens: ColorTokenRepository,
    private val palette: TenantPaletteRepository,
    private val typeSync: ColorTokenFamilyTypeSync = ColorTokenFamilyTypeSync(tokens),
) {
    /** Замена значений семейства токена [tokenId] в теме [tenantId]; результат — ревизия темы и тип семейства. */
    @Suppress("ReturnCount")
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        tokenId: UUID,
        command: UpdateColorTokenValues,
    ): DsResult<ColorTokenMutation<ThemeTokenType>> {
        val allowed = policy.require(context, ProjectScope.TENANTS_WRITE)
        if (allowed is DsResult.Failure) return allowed
        if (command.members.isEmpty()) {
            return DsResult.Failure(DsFailure.InvalidRequest("invalid_body", message = "Нет значений для сохранения"))
        }
        command.members.entries.firstOrNull { (_, values) ->
            values.isEmpty() || values.map { it.platform to it.mode }.distinct().size != values.size
        }?.let { (id, _) ->
            return DsResult.Failure(
                invalidTokenFamily("У определения $id нужны непустые значения без повторов платформы и режима"),
            )
        }
        if (command.members.values.flatten().any { it.baseRevision != null && it.baseRevision < 0 }) {
            return DsResult.Failure(DsFailure.InvalidRequest("invalid_base_revision"))
        }
        return transactions.required(context) {
            when (val lock = tokens.lock(context.projectId, tenantId, command.editRevision, allThemes = false)) {
                is ColorTokenLock.Locked -> update(context, tenantId, tokenId, lock, command)
                else -> DsResult.Failure(requireNotNull(lock.failure()))
            }
        }
    }

    @Suppress("ReturnCount")
    private suspend fun update(
        context: DsRequestContext,
        tenantId: UUID,
        tokenId: UUID,
        lock: ColorTokenLock.Locked,
        command: UpdateColorTokenValues,
    ): DsResult<ColorTokenMutation<ThemeTokenType>> {
        val stored = when (val found = tokens.family(lock.designSystemId, tokenId).storedOrFailure(tokenId)) {
            is DsResult.Failure -> return found
            is DsResult.Success -> found.value
        }
        val memberIds = stored.members.values.toSet()
        command.members.keys.firstOrNull { it !in memberIds }?.let { foreign ->
            return DsResult.Failure(invalidTokenFamily("Определение $foreign не входит в семейство токена $tokenId"))
        }
        val addressed = command.members.mapKeys { (id, _) -> id.toString() }
        palette.valueRule(tenantId).firstViolation(addressed)?.let { return DsResult.Failure(it) }
        tokens.replaceValues(tenantId, command.members.storedForm())
        val type = typeSync.sync(lock.designSystemId, tokenId) ?: stored.family.type
        val values = tokens.confirmedValues(lock.designSystemId, tenantId, stored.members.values)?.let { values ->
            com.dsbuilder.ds.themes.application.TokenValuePublisher(
                tenantId,
                palette.snapshot(context.projectId, tenantId),
            ).publish(values.map { it.copy(tokenType = type) })
        }
        return DsResult.Success(
            ColorTokenMutation(
                tokens.bumpRevisions(listOf(tenantId)).getValue(tenantId),
                type,
                confirmedValues = values,
            ),
        )
    }
}
