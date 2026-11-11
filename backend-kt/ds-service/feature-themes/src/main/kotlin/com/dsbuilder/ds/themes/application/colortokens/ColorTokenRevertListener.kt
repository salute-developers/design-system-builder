package com.dsbuilder.ds.themes.application.colortokens

import com.dsbuilder.ds.core.application.TokenRevertAction
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
    override val supportsLiteralValueBatchRevert: Boolean = true
    override fun prepareRevert(designSystemId: UUID, tokenId: UUID): Boolean {
        val family = repository.familyInDraft(designSystemId, tokenId) ?: return true
        // `false` — дизайн-система недоступна или нет черновика (откат вернёт 404); ошибки SQL не скрываются.
        return repository.lockFamilyDefinitions(designSystemId, family.members.values)
    }

    override fun beforeRevert(designSystemId: UUID, tokenId: UUID): () -> Unit =
        beforeBatchRevert(designSystemId, tokenId).run

    override fun beforeBatchRevert(designSystemId: UUID, tokenId: UUID): TokenRevertAction {
        val family = repository.familyInDraft(designSystemId, tokenId)
        val before = family?.members?.values.orEmpty().toSet() + tokenId
        val key = family?.family?.let { it.group to it.name } ?: tokenId
        return TokenRevertAction(key) {
            // Все исходные члены: откат переименования может разделить одно семейство на несколько.
            val handled = mutableSetOf<UUID>()
            before.sorted().forEach { member ->
                if (member in handled) return@forEach
                repository.familyInDraft(designSystemId, member)?.let { family ->
                    sync.sync(designSystemId, member)
                    handled += family.members.values
                }
            }
        }
    }
}
