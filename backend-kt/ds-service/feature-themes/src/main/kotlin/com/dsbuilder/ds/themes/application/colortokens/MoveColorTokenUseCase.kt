package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.authorization.ProjectScope
import com.dsbuilder.ds.core.application.DsAccessPolicy
import com.dsbuilder.ds.core.application.DsFailure
import com.dsbuilder.ds.core.application.DsRequestContext
import com.dsbuilder.ds.core.application.DsResult
import com.dsbuilder.ds.core.application.TransactionRunner
import com.dsbuilder.ds.themes.application.tokengroups.TokenGroupRepository
import com.dsbuilder.ds.themes.application.tokengroups.codeOf
import com.dsbuilder.ds.themes.application.tokengroups.invalidTokenGroup
import com.dsbuilder.ds.themes.application.tokengroups.renameAll
import com.dsbuilder.ds.themes.application.tokengroups.withAllThemes
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenNaming
import com.dsbuilder.ds.themes.domain.colortokens.TokenNameRule
import com.dsbuilder.ds.themes.domain.tokengroups.Ordering
import com.dsbuilder.ds.themes.domain.tokengroups.TokenGroupKind
import java.util.UUID

/**
 * Переносит семейство цветового токена в группу или подгруппу и при необходимости переименовывает его одной
 * транзакцией. Идентификаторы определений сохраняются, поэтому ссылки компонентов по `token_id` остаются верными.
 */
class MoveColorTokenUseCase(
    private val policy: DsAccessPolicy,
    private val transactions: TransactionRunner,
    private val tokens: ColorTokenRepository,
    private val groups: TokenGroupRepository,
) {
    /** Перенос токена [tokenId] в дизайн-системе темы [tenantId]. */
    suspend fun execute(
        context: DsRequestContext,
        tenantId: UUID,
        tokenId: UUID,
        command: MoveColorToken,
    ): DsResult<ColorTokenMutation<StoredColorTokenFamily>> {
        val allowed = policy.requireAll(context, ProjectScope.TENANTS_WRITE, ProjectScope.TOKENS_WRITE)
        if (allowed is DsResult.Failure) return allowed
        command.name?.let(::nameFailure)?.let { return DsResult.Failure(it) }
        return transactions.required(context) {
            tokens.withAllThemes(context, tenantId, command.editRevision) { lock ->
                move(tenantId, lock, tokenId, command)
            }
        }
    }

    @Suppress("ReturnCount")
    private suspend fun move(
        tenantId: UUID,
        lock: ColorTokenLock.Locked,
        tokenId: UUID,
        command: MoveColorToken,
    ): DsResult<ColorTokenMutation<StoredColorTokenFamily>> {
        val stored = when (val found = tokens.family(lock.designSystemId, tokenId).storedOrFailure(tokenId)) {
            is DsResult.Failure -> return found
            is DsResult.Success -> found.value
        }
        val target = groups.find(lock.designSystemId, command.groupId) ?: return DsResult.Failure(DsFailure.NotFound)
        if (target.kind != TokenGroupKind.COLOR) {
            return DsResult.Failure(invalidTokenGroup("Группа другого вида токенов"))
        }
        val code = groups.codeOf(target) ?: return DsResult.Failure(DsFailure.NotFound)
        val family = stored.family.copy(group = code, name = command.name ?: stored.family.name)
        val members = tokens.placedById(stored.members.values)
        tokens.renameAll(lock.designSystemId, members) { member ->
            ColorTokenNaming.rename(member.name, family.group, family.name)
        }?.let { return DsResult.Failure(it) }
        val familyIds = stored.members.values.toSet()
        val slots = tokens.placedIn(lock.designSystemId, listOf(target.id))
            .filter { it.id !in familyIds }
            .slots()
        tokens.arrange(target.id, Ordering.place(slots, familyIds.toList(), command.position))
        // Прежняя группа пересчитывается после ухода семейства.
        members.mapNotNull { it.groupId }.distinct().filter { it != target.id }.forEach { previous ->
            tokens.arrange(previous, tokens.placedIn(lock.designSystemId, listOf(previous)).slots())
        }
        val revision = tokens.bumpRevisions(lock.tenantIds).getValue(tenantId)
        val renamed = stored.members.entries.associate { (name, id) ->
            ColorTokenNaming.rename(name, family.group, family.name) to id
        }
        return DsResult.Success(
            ColorTokenMutation(
                revision,
                StoredColorTokenFamily(family, renamed),
                tokens.confirmedStructure(
                    lock.designSystemId,
                    renamed.values,
                    groupIds = members.mapNotNull { it.groupId } + target.id,
                ),
            ),
        )
    }
}

/** Отказ для нового имени токена или `null`, если имя допустимо. */
private fun nameFailure(name: String): DsFailure? = when {
    !TokenNameRule.validSegment(name) -> invalidTokenName("Имя токена — латиница в нижнем регистре, цифры и дефис")
    ColorTokenFamily.STATES.any { name.endsWith("-$it") } ->
        invalidTokenName("Имя токена не может оканчиваться на состояние: так называются состояния токена")
    else -> null
}
