package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.application.TokenValuePublisher
import com.dsbuilder.ds.themes.application.palette.TenantPaletteRepository
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import java.util.UUID

/** Код отказа неизвестного состояния цветового токена. */
internal const val INVALID_TOKEN_STATE = "INVALID_TOKEN_STATE"

/**
 * Добавляет состояние существующему цветовому токену одной транзакцией: определения состояния во всех подгруппах
 * семейства на месте семейства в его группе, значения каждой темы дизайн-системы из запроса и увеличение ревизий всех
 * тем. Формулу состояний считает клиент: значения у тем разные.
 */
class AddColorTokenStateUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val tokens: ColorTokenRepository,
    private val palette: TenantPaletteRepository,
    private val typeSync: ColorTokenFamilyTypeSync = ColorTokenFamilyTypeSync(tokens),
) {
    /** Добавление состояния [AddColorTokenState.state] семейству токена [tokenId] из темы [tenantId]. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        tokenId: UUID,
        command: AddColorTokenState,
    ): DsResult<ColorTokenMutation<StoredColorTokenFamily>> {
        val allowed = policy.requireAll(context, ProjectScope.TENANTS_WRITE, ProjectScope.TOKENS_WRITE)
        if (allowed is DsResult.Failure) return allowed
        command.structureFailure()?.let { return DsResult.Failure(it) }
        return transactions.required(context) {
            when (val lock = tokens.lock(context.projectId, tenantId, command.editRevision, allThemes = true)) {
                is ColorTokenLock.Locked -> when (
                    val found = tokens.family(lock.designSystemId, tokenId).storedOrFailure(tokenId)
                ) {
                    is DsResult.Failure -> found
                    is DsResult.Success -> add(context, tenantId, lock, found.value, command)
                }
                else -> DsResult.Failure(requireNotNull(lock.failure()))
            }
        }
    }

    @Suppress("ReturnCount")
    private suspend fun add(
        context: DsRequestContext,
        tenantId: UUID,
        lock: ColorTokenLock.Locked,
        stored: StoredColorTokenFamily,
        command: AddColorTokenState,
    ): DsResult<ColorTokenMutation<StoredColorTokenFamily>> {
        val family = stored.family
        val names = family.stateMembers(command.state, stored.members.keys)
            .sortedWith(compareBy({ it != stateDefault(family, command.state) }, { it }))
        tokens.takenNames(lock.designSystemId, names).sorted().firstOrNull()?.let { taken ->
            return DsResult.Failure(
                DsFailure.Conflict(TOKEN_NAME_CONFLICT, message = "Состояние $taken уже есть в дизайн-системе"),
            )
        }
        compositionFailure(lock.tenantIds, names.toSet(), command)?.let { return DsResult.Failure(it) }
        command.tenants.forEach { (tenant, members) ->
            palette.valueRule(tenant).firstViolation(members)?.let { return DsResult.Failure(it) }
        }
        val defaultId = stored.members[family.defaultMember()]
            ?: return DsResult.Failure(invalidTokenFamily("Нет определения ${family.defaultMember()}"))
        val anchor = tokens.placedById(listOf(defaultId)).single()
        val ids = tokens.insertDefinitions(
            lock.designSystemId,
            family,
            names,
            null,
            null,
            anchor.groupId,
            anchor.position,
        )
        command.tenants.toSortedMap().forEach { (tenant, members) ->
            tokens.insertValues(listOf(tenant), members.storedForm().mapKeys { (name, _) -> ids.getValue(name) })
        }
        val type = typeSync.sync(lock.designSystemId, ids.values.first()) ?: family.type
        val revision = tokens.bumpRevisions(lock.tenantIds).getValue(tenantId)
        val members = stored.members + ids
        val values = tokens.confirmedValues(lock.designSystemId, tenantId, ids.values)?.let { values ->
            TokenValuePublisher(palette.snapshot(context.projectId, tenantId)?.forValueResolution())
                .publish(values.map { it.copy(tokenType = type) })
        }
        return DsResult.Success(
            ColorTokenMutation(
                revision,
                StoredColorTokenFamily(family.copy(type = type), members),
                tokens.confirmedStructure(
                    lock.designSystemId,
                    ids.values,
                    groupIds = listOfNotNull(anchor.groupId),
                ),
                values,
            ),
        )
    }

    /** `400 INVALID_TOKEN_FAMILY`, если темы или члены запроса не совпадают с темами и членами состояния. */
    private fun compositionFailure(
        tenantIds: Collection<UUID>,
        names: Set<String>,
        command: AddColorTokenState,
    ): DsFailure? = when {
        command.tenants.keys != tenantIds.toSet() ->
            invalidTokenFamily("Состояние добавляется со значениями каждой темы дизайн-системы")
        command.tenants.values.any { it.keys != names } ->
            invalidTokenFamily("Члены состояния каждой темы: ${names.sorted().joinToString()}")
        else -> null
    }
}

/** Отказ `400 INVALID_TOKEN_STATE` для состояния вне [ColorTokenFamily.STATES]. */
internal fun unknownState(state: String) =
    DsFailure.InvalidRequest(INVALID_TOKEN_STATE, message = "Состояние $state: допустимы hover, active, brightness")

/** Член состояния [state] подгруппы `default` семейства [family]. */
internal fun stateDefault(family: ColorTokenFamily, state: String): String =
    "${family.group}.${ColorTokenFamily.DEFAULT_SUBGROUP}.${family.name}-$state"

/** Отказ в структуре запроса или `null`: состояние известно, у каждого члена полный набор значений. */
private fun AddColorTokenState.structureFailure(): DsFailure? = when {
    state !in ColorTokenFamily.STATES -> unknownState(state)
    tenants.values.any { members -> members.values.any { it.isIncomplete() } } ->
        invalidTokenFamily("У членов состояния нужны значения web, ios и android для light и dark")
    else -> null
}
