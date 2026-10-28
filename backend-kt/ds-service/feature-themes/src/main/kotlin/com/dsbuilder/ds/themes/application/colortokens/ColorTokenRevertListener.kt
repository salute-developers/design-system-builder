package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.ds.core.application.TokenRevertListener
import java.util.UUID

/**
 * После отката записи журнала об определении или значении цветового токена возвращает типу семейства соответствие
 * действующим значениям. Пересчитываются семейство токена после отката и семейство, в которое он входил до отката:
 * откат переименования переносит определение между семействами. До блокировки записи определения блокируются
 * определения его семейства в устойчивом порядке; порядок блокировок записей значений общий
 * (см. [com.dsbuilder.ds.core.application.TokenValueWritePolicy]).
 */
class ColorTokenRevertListener(
    private val repository: ColorTokenRepository,
    private val sync: ColorTokenFamilyTypeSync = ColorTokenFamilyTypeSync(repository),
) : TokenRevertListener {
    override fun prepareRevert(designSystemId: UUID, tokenId: UUID): Boolean {
        val family = repository.familyInDraft(designSystemId, tokenId) ?: return true
        // `false` — дизайн-система недоступна или нет черновика (откат вернёт 404); ошибки SQL не скрываются.
        return repository.lockFamilyDefinitions(designSystemId, family.members.values)
    }

    override fun beforeRevert(designSystemId: UUID, tokenId: UUID): () -> Unit {
        val before = repository.familyInDraft(designSystemId, tokenId)?.members?.values.orEmpty()
        return {
            val synced = sync.sync(designSystemId, tokenId)
                ?.let { repository.familyInDraft(designSystemId, tokenId)?.members?.values.orEmpty().toSet() }
                .orEmpty()
            // Прежние соседи по семейству: достаточно одного живого члена на каждое ещё не пересчитанное семейство.
            val handled = synced.toMutableSet()
            before.sorted().filter { it != tokenId && it !in handled }.forEach { member ->
                repository.familyInDraft(designSystemId, member)?.let { family ->
                    sync.sync(designSystemId, member)
                    handled += family.members.values
                }
            }
        }
    }
}
