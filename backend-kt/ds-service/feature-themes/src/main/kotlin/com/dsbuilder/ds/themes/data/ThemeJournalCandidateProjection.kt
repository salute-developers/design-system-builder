package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.application.DraftChangePolicy
import com.dsbuilder.ds.core.application.JournalCandidateExclusionPolicy
import com.dsbuilder.ds.core.application.JournalCandidateProjection
import com.dsbuilder.ds.core.application.JournalProjectionScope
import com.dsbuilder.ds.core.data.BatchJdbc
import java.util.UUID

/** Отбрасывает только доказанно неизменённые технические создания новой темы, без сборки JSON-снимков. */
class ThemeJournalCandidateProjection : JournalCandidateProjection {
    override val entityType = "token-value"
    override val requiredChangedTypes = setOf("tenant")

    override fun supports(policies: List<DraftChangePolicy>): Boolean =
        policies.isNotEmpty() && policies.all {
            it is JournalCandidateExclusionPolicy && it.permits(THEME_CREATION_EXCLUSION)
        }

    override fun visit(scope: JournalProjectionScope, consume: (List<UUID>) -> Unit) {
        var after: UUID? = null
        do {
            val batch = BatchJdbc().read(
                sql,
                scope.designSystemId,
                scope.boundaryId,
                scope.sequenceNumber,
                scope.previousSequenceNumber,
                scope.tenantId,
                after,
            ) { it.getObject("id", UUID::class.java) }
            if (batch.isEmpty()) return
            consume(batch)
            after = batch.last()
        } while (batch.size == 500)
    }

    private val sql = requireNotNull(javaClass.getResource("/dsbuilder/ds/seeds/journal-candidates.sql")).readText()
}

internal const val THEME_CREATION_EXCLUSION = "theme-creation-baseline-v1"
