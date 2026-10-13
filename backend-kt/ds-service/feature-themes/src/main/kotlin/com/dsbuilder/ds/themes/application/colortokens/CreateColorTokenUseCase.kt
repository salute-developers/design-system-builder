package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.application.palette.toFailure
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.domain.colortokens.TokenNameRule
import com.dsbuilder.ds.themes.domain.palette.PaletteOperationResult
import com.dsbuilder.ds.themes.domain.palette.PaletteOperations
import com.dsbuilder.ds.themes.domain.palette.ThemePaletteBuilder
import java.util.UUID

/**
 * Создаёт цветовой токен одной транзакцией: определения семейства, начальные значения во всех темах дизайн-системы,
 * привязку к группе палитры текущей темы и увеличение ревизий всех тем.
 */
class CreateColorTokenUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val tokens: ColorTokenRepository,
    private val palette: TenantPaletteRepository,
) {
    /** Создание токена [command] в теме [tenantId]. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        command: CreateColorToken,
    ): DsResult<ColorTokenMutation<StoredColorTokenFamily>> {
        val allowed = policy.requireAll(context, ProjectScope.TENANTS_WRITE, ProjectScope.TOKENS_WRITE)
        if (allowed is DsResult.Failure) return allowed
        command.structureFailure()?.let { return DsResult.Failure(it) }
        return transactions.required {
            val lock = tokens.lock(context.projectId, tenantId, command.editRevision, allThemes = true)
            when (lock) {
                is ColorTokenLock.Locked -> create(context, tenantId, lock, command)
                else -> DsResult.Failure(requireNotNull(lock.failure()))
            }
        }
    }

    @Suppress("ReturnCount")
    private suspend fun create(
        context: DsRequestContext,
        tenantId: UUID,
        lock: ColorTokenLock.Locked,
        command: CreateColorToken,
    ): DsResult<ColorTokenMutation<StoredColorTokenFamily>> {
        val rule = palette.valueRule(tenantId)
        rule.firstViolation(command.family.type, command.members)?.let { return DsResult.Failure(it) }
        val names = command.members.keys.sortedWith(compareBy({ it != command.family.defaultMember() }, { it }))
        tokens.takenNames(lock.designSystemId, names).sorted().firstOrNull()?.let { taken ->
            return DsResult.Failure(
                DsFailure.Conflict(TOKEN_NAME_CONFLICT, message = "Токен $taken уже есть в дизайн-системе"),
            )
        }
        val ids = tokens.insertDefinitions(
            lock.designSystemId,
            command.family,
            names,
            command.displayName,
            command.description,
        )
        tokens.insertValues(lock.tenantIds, command.members.mapKeys { (name, _) -> ids.getValue(name) })
        val groupId = command.paletteGroupId
        val revision = if (groupId == null) {
            tokens.bumpRevisions(lock.tenantIds).getValue(tenantId)
        } else {
            when (val assigned = assignGroup(context, tenantId, lock.editRevision + 1, ids.values, groupId)) {
                is DsResult.Failure -> return assigned
                is DsResult.Success -> tokens.bumpRevisions(lock.tenantIds - tenantId).let { assigned.value }
            }
        }
        return DsResult.Success(ColorTokenMutation(revision, StoredColorTokenFamily(command.family, ids)))
    }

    /** Явно привязывает [tokenIds] к группе [groupId] и записывает палитру с ревизией [revision]. */
    private suspend fun assignGroup(
        context: DsRequestContext,
        tenantId: UUID,
        revision: Int,
        tokenIds: Collection<UUID>,
        groupId: String,
    ): DsResult<Int> {
        val snapshot = palette.snapshot(context.projectId, tenantId) ?: return DsResult.Failure(DsFailure.NotFound)
        val built =
            ThemePaletteBuilder.build(tenantId.toString(), true, snapshot.state, snapshot.tokens, snapshot.values)
        var state = snapshot.state
        tokenIds.forEach { tokenId ->
            when (val result = PaletteOperations.assignTokenGroup(state, tokenId.toString(), groupId, built)) {
                is PaletteOperationResult.Rejected -> return DsResult.Failure(result.error.toFailure())
                is PaletteOperationResult.Applied -> state = result.state
            }
        }
        palette.save(tenantId, state.copy(editRevision = revision))
        return DsResult.Success(revision)
    }
}

/** Отказ в структуре запроса создания или `null`, если имена, семейство и набор значений корректны. */
@Suppress("ReturnCount")
private fun CreateColorToken.structureFailure(): DsFailure? {
    if (!TokenNameRule.validSegment(family.group) || !TokenNameRule.validSegment(family.name)) {
        return invalidTokenName("Группа и имя токена — латиница в нижнем регистре, цифры и дефис")
    }
    ColorTokenFamily.STATES.firstOrNull { family.name.endsWith("-$it") }?.let { state ->
        return invalidTokenName("Имя токена не может оканчиваться на -$state: так называются состояния токена")
    }
    members.keys.firstNotNullOfOrNull(TokenNameRule::validate)?.let { return invalidTokenName(it) }
    members.keys.firstOrNull { !family.memberOf(family.type, it) }?.let { name ->
        return invalidTokenFamily("Определение $name не входит в семейство ${family.group}.${family.name}")
    }
    if (family.defaultMember() !in members) {
        return invalidTokenFamily("Нет обязательного определения ${family.defaultMember()}")
    }
    members.entries.firstOrNull { (_, values) -> values.isIncomplete() }?.let { (name, _) ->
        return invalidTokenFamily("У определения $name нужны значения web, ios и android для light и dark")
    }
    if (paletteGroupId != null && family.type != ThemeTokenType.COLOR) {
        return invalidTokenFamily("Группа палитры задаётся только цветовому токену, не градиентному")
    }
    return null
}
