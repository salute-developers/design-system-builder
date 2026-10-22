package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamilyType
import java.util.UUID

/**
 * Пересчёт типа семейства цветового токена после записи или отката значения в той же транзакции. Общий для use case
 * и обработчика журнала: блокирует определения семейства в устойчивом порядке, вычисляет тип по значениям всех тем
 * на границе черновика и при смене пишет редакции `/type` всех членов. Члены семейства выбираются по правилу имени
 * независимо от их текущего типа. Значения тем не переписываются.
 */
class ColorTokenFamilyTypeSync(private val repository: ColorTokenRepository) {
    /** Тип семейства токена [tokenId] после пересчёта или `null`, если токен вне семейств цветовых токенов. */
    fun sync(designSystemId: UUID, tokenId: UUID): ThemeTokenType? {
        val found = repository.familyInDraft(designSystemId, tokenId) ?: return null
        val locked = found.members.values.toSet()
        lock(designSystemId, locked)
        return recompute(designSystemId, tokenId, locked)
    }

    /**
     * Пересчёт типа семейств, на которые повлияло удаление, восстановление или откат создания темы [tenantId]:
     * значения темы перестали или снова начали участвовать в вычислении. Определения всех затронутых семейств
     * блокируются одним вызовом в порядке идентификаторов, затем семейства перечитываются одним чтением под
     * блокировкой и каждое пересчитывается один раз.
     */
    fun syncTenantFamilies(designSystemId: UUID, tenantId: UUID) {
        val candidates = repository.familyTypeCandidates(designSystemId, tenantId)
        if (candidates.isEmpty()) return
        val members = candidates.flatMapTo(mutableSetOf()) { it.members.values }
        lock(designSystemId, members)
        val representatives = candidates.map { it.members.values.min() }
        val current = repository.familiesInDraft(designSystemId, representatives)
        val handled = mutableSetOf<UUID>()
        representatives.forEach { tokenId ->
            if (tokenId in handled) return@forEach
            val stored = current[tokenId] ?: return@forEach
            recompute(designSystemId, stored, members)
            handled += stored.members.values
        }
    }

    /**
     * Тип семейства токена [tokenId] по значениям под блокировкой [locked]. Семейство перечитывается: конкурентная
     * запись могла уже сменить тип или состав семейства.
     */
    private fun recompute(designSystemId: UUID, tokenId: UUID, locked: Set<UUID>): ThemeTokenType? =
        repository.familyInDraft(designSystemId, tokenId)?.let { recompute(designSystemId, it, locked) }

    /** Тип семейства [stored], прочитанного под блокировкой [locked]; новые члены блокируются дополнительно. */
    private fun recompute(designSystemId: UUID, stored: StoredColorTokenFamily, locked: Set<UUID>): ThemeTokenType {
        val members = stored.members.values.toSet()
        (members - locked).takeIf { it.isNotEmpty() }?.let { lock(designSystemId, it) }
        val type = ColorTokenFamilyType.of(repository.familyValuesInDraft(designSystemId, members))
        // Тип пишется всем членам, у которых он отличается: после отката одного определения типы могли разойтись.
        if (members.any { (stored.memberTypes[it] ?: stored.family.type) != type }) {
            repository.reviseFamilyType(members, type)
        }
        return type
    }

    private fun lock(designSystemId: UUID, tokenIds: Collection<UUID>) {
        check(repository.lockFamilyDefinitions(designSystemId, tokenIds)) {
            "Definitions of the color token family cannot be locked"
        }
    }
}
