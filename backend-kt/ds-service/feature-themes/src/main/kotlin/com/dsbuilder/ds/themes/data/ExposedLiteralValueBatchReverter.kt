package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.application.DraftValueBatchOutcome
import com.dsbuilder.ds.core.application.DraftValueBatchRequest
import com.dsbuilder.ds.core.application.DraftValueBatchReverter
import com.dsbuilder.ds.core.data.BatchJdbc
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamilyType
import com.dsbuilder.ds.themes.domain.colortokens.FamilyValue
import kotlinx.serialization.json.Json
import java.sql.SQLException
import java.util.UUID

/** Пакетный откат существующих значений без восстанавливаемых ссылок и изменения типа цветового семейства. */
class ExposedLiteralValueBatchReverter : DraftValueBatchReverter {
    override suspend fun revert(request: DraftValueBatchRequest): DraftValueBatchOutcome {
        val jdbc = BatchJdbc()
        val plan = plan(jdbc, request) ?: return DraftValueBatchOutcome.NOT_APPLICABLE
        return executePlan(jdbc, request, plan)
    }

    /** Предварительное чтение планирует блокировки, но не разрешает мутацию до повторной проверки. */
    private fun plan(jdbc: BatchJdbc, request: DraftValueBatchRequest): ValueBatchPlan? {
        if (request.targets.isEmpty() || request.targets.size > 200 ||
            request.targets.distinctBy { it.first }.size != request.targets.size
        ) {
            return null
        }
        val rows = selected(request, LiteralValueBatchReader(jdbc).snapshot(request)) ?: return null
        val draft = rows.first().boundaryId
        val sequence = rows.first().sequenceNumber
        val ids = rows.map { requireNotNull(it.entityId) }
        val specs = rows.mapNotNull(LiteralValueSnapshot::family).toSet()
        val families = LiteralValueBatchReader(jdbc).members(request.designSystemId, sequence, specs)
        val members = families.map(LiteralFamilyMember::id).distinct().sorted()
        return if (specs.isNotEmpty() && families.isEmpty()) {
            null
        } else {
            ValueBatchPlan(draft, sequence, ids, specs, members, rows)
        }
    }

    private fun executePlan(
        jdbc: BatchJdbc,
        request: DraftValueBatchRequest,
        plan: ValueBatchPlan,
    ): DraftValueBatchOutcome {
        jdbc.query("SAVEPOINT value_batch")
        return try {
            val outcome = when {
                !lockSubjects(jdbc, request.designSystemId, plan.draft, plan.ids, plan.members) ->
                    DraftValueBatchOutcome.NOT_APPLICABLE
                !matchesPlan(jdbc, request, plan) -> DraftValueBatchOutcome.NOT_APPLICABLE
                else -> {
                    applyValues(jdbc, plan.draft, plan.ids)
                    DraftValueBatchOutcome.REVERTED
                }
            }
            finish(jdbc, outcome)
        } catch (failure: SQLException) {
            if (failure.sqlState !in setOf("23503", "23505", "23514")) throw failure
            finish(jdbc, DraftValueBatchOutcome.DEPENDENCY_CONFLICT)
        }
    }

    private fun finish(jdbc: BatchJdbc, outcome: DraftValueBatchOutcome): DraftValueBatchOutcome {
        if (outcome != DraftValueBatchOutcome.REVERTED) jdbc.query("ROLLBACK TO SAVEPOINT value_batch")
        jdbc.query("RELEASE SAVEPOINT value_batch")
        return outcome
    }

    private fun matchesPlan(jdbc: BatchJdbc, request: DraftValueBatchRequest, plan: ValueBatchPlan): Boolean {
        val current = selected(request, LiteralValueBatchReader(jdbc).snapshot(request)) ?: return false
        // Полное равенство включает boundary_id, редакции, определения и прежнее/текущее содержимое.
        if (current != plan.rows) return false
        val lockedFamilies = LiteralValueBatchReader(jdbc).restoredValues(
            request.designSystemId,
            plan.sequence,
            plan.draft,
            plan.ids,
            plan.specs,
            plan.members,
        )
        return lockedFamilies.map { it.member.id }.distinct().sorted() == plan.members &&
            matchingFamilyTypes(lockedFamilies)
    }

    private fun selected(
        request: DraftValueBatchRequest,
        rows: List<LiteralValueSnapshot>,
    ): List<LiteralValueSnapshot>? {
        if (rows.isEmpty() || rows.size > 200) return null
        val byId = rows.associateBy(LiteralValueSnapshot::entityId)
        val result = mutableListOf<LiteralValueSnapshot>()
        for ((id, expected) in request.targets) {
            val row = byId[id]?.takeIf { eligible(it, expected) } ?: return null
            result += row
        }
        return result
    }

    private fun eligible(row: LiteralValueSnapshot, expected: Long): Boolean =
        row.matchesRevision(expected) && row.hasPublishedParents() && row.isRestorableLiteral()

    private data class ValueBatchPlan(
        val draft: UUID,
        val sequence: Long,
        val ids: List<UUID>,
        val specs: Set<ColorTokenFamily>,
        val members: List<UUID>,
        val rows: List<LiteralValueSnapshot>,
    )

    private fun lockSubjects(
        jdbc: BatchJdbc,
        owner: UUID,
        draft: UUID,
        ids: List<UUID>,
        members: List<UUID>,
    ): Boolean {
        jdbc.query(
            "SELECT pg_advisory_xact_lock_shared(hashtextextended(CAST(? AS text),684313))",
            owner,
        )
        if (members.isNotEmpty()) {
            jdbc.query(
                """
                    INSERT INTO entity_edit_states(design_system_version_id,design_system_id,entity_type,
                      entity_id,revision,last_actor_id,updated_at)
                    SELECT ?,?,'token',id,0,coalesce(nullif(current_setting('ds.actor_id',true),''),'system'),now()
                    FROM unnest(?::uuid[]) id ON CONFLICT DO NOTHING
                """.trimIndent(),
                draft,
                owner,
                jdbc.uuids(members),
            )
        }
        for ((type, addresses) in listOf("token-value" to ids, "token" to members)) {
            if (addresses.isEmpty()) continue
            val locked = jdbc.query(
                "SELECT entity_id FROM entity_edit_states WHERE design_system_version_id=? " +
                    "AND entity_type=? AND entity_id=ANY(?) ORDER BY entity_id FOR UPDATE",
                draft,
                type,
                jdbc.uuids(addresses),
            )
            if (locked.size != addresses.size) return false
        }
        return true
    }

    private fun applyValues(jdbc: BatchJdbc, draft: UUID, ids: List<UUID>) {
        val mutated = jdbc.query(
            """
                    WITH removed AS (
                      DELETE FROM token_value_revisions WHERE design_system_version_id=?
                        AND token_value_id=ANY(?) RETURNING token_value_id),
                    paths AS (
                      DELETE FROM entity_edit_paths WHERE design_system_version_id=? AND entity_type='token-value'
                        AND entity_id IN (SELECT token_value_id FROM removed) RETURNING entity_id)
                    SELECT (SELECT count(*) FROM removed) AS removed_count,(SELECT count(*) FROM paths) AS paths_count
            """.trimIndent(),
            draft,
            jdbc.uuids(ids),
            draft,
        ).single()
        check(mutated["removed_count"]?.toInt() == ids.size) { "Batch revision set changed under locks" }
        listOf(
            "SELECT set_config('ds.palette_checked_boundaries','',true)",
            "SET CONSTRAINTS ALL IMMEDIATE",
            "SET CONSTRAINTS ALL DEFERRED",
            "SELECT set_config('ds.palette_checked_boundaries','',true)",
        ).forEach { jdbc.query(it) }
    }

    private fun matchingFamilyTypes(rows: List<RestoredFamilyValue>): Boolean {
        val keys = rows.distinctBy { it.member.id }.associate { row ->
            val member = row.member
            val family = ColorTokenFamily.of(member.type, member.name) ?: return false
            member.id to (family.group to family.name)
        }
        return rows.groupBy { keys[it.member.id] }.values.all { group ->
            val values = group.mapNotNull { row ->
                if (row.tenantDeleted != false) return@mapNotNull null
                val value = row.value ?: return@mapNotNull null
                val platform = row.platform ?: return@mapNotNull null
                FamilyValue(platform, Json.parseToJsonElement(value))
            }
            val type = ColorTokenFamilyType.of(values).wireValue
            group.all { it.member.type.wireValue == type }
        }
    }
}
