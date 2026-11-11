package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.application.DraftValueBatchOutcome
import com.dsbuilder.ds.core.application.DraftValueBatchRequest
import com.dsbuilder.ds.core.application.DraftValueBatchReverter
import com.dsbuilder.ds.core.data.BatchJdbc
import com.dsbuilder.ds.themes.domain.ThemeTokenPlatform
import com.dsbuilder.ds.themes.domain.ThemeTokenType
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamilyType
import com.dsbuilder.ds.themes.domain.colortokens.FamilyValue
import com.dsbuilder.ds.themes.domain.colortokens.ValuePaletteReferences
import kotlinx.serialization.json.Json
import java.sql.SQLException
import java.util.UUID

/** Пакетный откат существующих значений без восстанавливаемых ссылок и изменения типа цветового семейства. */
class ExposedLiteralValueBatchReverter : DraftValueBatchReverter {
    override suspend fun revert(request: DraftValueBatchRequest): DraftValueBatchOutcome {
        if (request.targets.isEmpty() || request.targets.size > 200 ||
            request.targets.distinctBy { it.first }.size != request.targets.size
        ) {
            return DraftValueBatchOutcome.NOT_APPLICABLE
        }
        val jdbc = BatchJdbc()
        val before = snapshot(jdbc, request)
        val selected = selected(request, before) ?: return DraftValueBatchOutcome.NOT_APPLICABLE
        val draft = UUID.fromString(selected.first().getValue("boundary_id"))
        val sequence = selected.first().getValue("sequence_number")!!.toLong()
        val ids = selected.map { UUID.fromString(it.getValue("entity_id")) }
        val specs = selected.mapNotNull {
            val type = ThemeTokenType.fromWire(it["type"]) ?: return DraftValueBatchOutcome.NOT_APPLICABLE
            ColorTokenFamily.of(type, it.getValue("name")!!)
        }.toSet()
        val families = families(jdbc, request.designSystemId, sequence, draft, ids, specs)
        if (specs.isNotEmpty() && families.isEmpty()) return DraftValueBatchOutcome.NOT_APPLICABLE
        val members = families.map { UUID.fromString(it.getValue("id")) }.distinct().sorted()
        jdbc.query("SAVEPOINT value_batch")
        fun abandon(): DraftValueBatchOutcome {
            jdbc.query("ROLLBACK TO SAVEPOINT value_batch")
            jdbc.query("RELEASE SAVEPOINT value_batch")
            return DraftValueBatchOutcome.NOT_APPLICABLE
        }
        try {
            jdbc.query(
                "SELECT pg_advisory_xact_lock_shared(hashtextextended(CAST(? AS text),684313))",
                request.designSystemId,
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
                    request.designSystemId,
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
                if (locked.size != addresses.size) return abandon()
            }
            val current = selected(request, snapshot(jdbc, request)) ?: return abandon()
            if (current.map { it["boundary_id"] }.toSet() != setOf(draft.toString()) || current != selected) {
                return abandon()
            }
            val lockedFamilies = families(jdbc, request.designSystemId, sequence, draft, ids, specs, members)
            if (lockedFamilies.map { UUID.fromString(it.getValue("id")) }.distinct().sorted() != members ||
                !matchingFamilyTypes(lockedFamilies)
            ) {
                return abandon()
            }
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
            jdbc.query("RELEASE SAVEPOINT value_batch")
            return DraftValueBatchOutcome.REVERTED
        } catch (failure: SQLException) {
            if (failure.sqlState !in setOf("23503", "23505", "23514")) throw failure
            jdbc.query("ROLLBACK TO SAVEPOINT value_batch")
            jdbc.query("RELEASE SAVEPOINT value_batch")
            return DraftValueBatchOutcome.DEPENDENCY_CONFLICT
        }
    }

    private fun selected(
        request: DraftValueBatchRequest,
        rows: List<Map<String, String?>>,
    ): List<Map<String, String?>>? {
        if (rows.isEmpty() || rows.size > 200 || rows.first()["boundary_id"] == null) return null
        val byId = rows.filter { it["entity_id"] != null }.associateBy {
            UUID.fromString(it.getValue("entity_id"))
        }
        return request.targets.map { (id, expected) ->
            val row = byId[id] ?: return null
            if (row["entity_type"] != "token-value" || row["revision"]?.toLong() != expected ||
                row["current_boundary"] != row["boundary_id"] || row["previous_exists"] == null ||
                row["previous_deleted"] !in FALSE || row["token_deleted"] !in FALSE ||
                row["tenant_deleted"] !in FALSE || row["creation_baseline"] !in FALSE ||
                ThemeTokenType.fromWire(row["type"]) == null ||
                row["previous_palette_id"] != null || row["current_payload"] == row["previous_payload"]
            ) {
                return null
            }
            if (listOf("previous_value").any { key ->
                    row[key]?.let { ValuePaletteReferences.find(Json.parseToJsonElement(it)).isNotEmpty() } == true
                }
            ) {
                return null
            }
            row
        }
    }

    private fun snapshot(jdbc: BatchJdbc, request: DraftValueBatchRequest): List<Map<String, String?>> = jdbc.query(
        """
            WITH boundary AS MATERIALIZED (
              SELECT b.* FROM design_system_versions b JOIN design_systems s ON s.id=b.design_system_id
              JOIN LATERAL (SELECT deleted FROM design_system_revisions r WHERE r.design_system_id=s.id
                AND r.version_sequence_number<=b.sequence_number ORDER BY r.version_sequence_number DESC LIMIT 1) r
                ON NOT r.deleted
              WHERE b.design_system_id=? AND b.id=? AND b.status='draft' AND b.snapshot IS NULL
                AND ds_request_matches_design_system(b.design_system_id) AND (? OR s.project_id=?)),
            previous_boundary AS MATERIALIZED (
              SELECT coalesce(max(v.sequence_number) FILTER(WHERE v.status='published'),
                max(v.sequence_number) FILTER(WHERE v.status='baseline')) AS sequence_number
              FROM design_system_versions v JOIN boundary b ON b.design_system_id=v.design_system_id
              WHERE v.sequence_number<b.sequence_number),
            selected_states AS MATERIALIZED (
              SELECT e.* FROM entity_edit_states e JOIN boundary b ON b.id=e.design_system_version_id
              WHERE e.entity_type='token-value' AND e.entity_id=ANY(?)
              ORDER BY e.entity_id)
            SELECT b.id AS boundary_id,b.sequence_number,e.entity_type,e.entity_id,e.revision,
              v.token_id,v.tenant_id,v.platform,v.mode,r.design_system_version_id AS current_boundary,
              r.value,r.palette_id,r.deleted,t.name,t.type,t.deleted AS token_deleted,n.deleted AS tenant_deleted,
              p.token_value_id AS previous_exists,p.deleted AS previous_deleted,p.value AS previous_value,
              p.palette_id AS previous_palette_id,
              CASE WHEN r.deleted THEN NULL ELSE jsonb_build_object('value',r.value,'palette_id',r.palette_id,
                'overridden',r.overridden) END AS current_payload,
              CASE WHEN p.deleted THEN NULL ELSE jsonb_build_object('value',p.value,'palette_id',p.palette_id,
                'overridden',p.overridden) END AS previous_payload,
              EXISTS(SELECT 1 FROM token_value_creation_baselines c WHERE c.design_system_version_id=b.id
                AND c.token_value_id=v.id) AS creation_baseline
            FROM boundary b CROSS JOIN previous_boundary pb LEFT JOIN selected_states e ON true
            LEFT JOIN token_values v ON e.entity_type='token-value' AND v.id=e.entity_id
              AND v.design_system_id=b.design_system_id
            LEFT JOIN LATERAL (SELECT * FROM token_value_revisions r WHERE r.token_value_id=v.id
              AND r.version_sequence_number<=b.sequence_number
              ORDER BY r.version_sequence_number DESC LIMIT 1) r ON true
            LEFT JOIN LATERAL (SELECT * FROM token_value_revisions p WHERE p.token_value_id=v.id
              AND p.version_sequence_number<=pb.sequence_number
              ORDER BY p.version_sequence_number DESC LIMIT 1) p ON true
            LEFT JOIN LATERAL (SELECT * FROM token_revisions t WHERE t.token_id=v.token_id
              AND t.version_sequence_number<=b.sequence_number
              ORDER BY t.version_sequence_number DESC LIMIT 1) t ON true
            LEFT JOIN LATERAL (SELECT * FROM tenant_revisions n WHERE n.tenant_id=v.tenant_id
              AND n.version_sequence_number<=b.sequence_number
              ORDER BY n.version_sequence_number DESC LIMIT 1) n ON true
            ORDER BY e.entity_type,e.entity_id
        """.trimIndent(),
        request.designSystemId,
        request.draftId,
        request.systemAdmin,
        request.projectId,
        jdbc.uuids(request.targets.map { it.first }),
    )

    private fun families(
        jdbc: BatchJdbc,
        owner: UUID,
        sequence: Long,
        draft: UUID,
        ids: List<UUID>,
        specs: Set<ColorTokenFamily>,
        knownMembers: List<UUID>? = null,
    ): List<Map<String, String?>> {
        if (specs.isEmpty()) return emptyList()
        val names = specs.flatMap { it.candidateNames() }.toSet()
        if (knownMembers == null) {
            return jdbc.query(
                """
                    SELECT t.id,r.type,r.name FROM tokens t JOIN LATERAL (SELECT * FROM token_revisions r
                      WHERE r.token_id=t.id AND r.version_sequence_number<=?
                      ORDER BY r.version_sequence_number DESC LIMIT 1) r ON true
                    WHERE t.design_system_id=? AND NOT r.deleted AND r.name=ANY(?)
                      AND r.type IN ('color','gradient') ORDER BY t.id
                """.trimIndent(),
                sequence,
                owner,
                jdbc.texts(names),
            ).filter { row -> specs.any { it.memberOf(ThemeTokenType.COLOR, row["name"].orEmpty()) } }
        }
        return jdbc.query(
            """
            WITH members AS MATERIALIZED (
              SELECT t.id,r.type,r.name FROM tokens t JOIN LATERAL (SELECT * FROM token_revisions r
                WHERE r.token_id=t.id AND r.version_sequence_number<=?
                ORDER BY r.version_sequence_number DESC LIMIT 1) r ON true
              WHERE t.design_system_id=? AND NOT r.deleted AND r.name=ANY(?) AND r.type IN ('color','gradient')),
            selected_values AS MATERIALIZED (
              SELECT * FROM token_values WHERE design_system_id=? AND token_id=ANY(?))
            SELECT m.id,m.type,m.name,v.platform,r.value,n.deleted AS tenant_deleted
            FROM members m LEFT JOIN selected_values v ON v.token_id=m.id
            LEFT JOIN LATERAL (SELECT * FROM tenant_revisions n WHERE n.tenant_id=v.tenant_id
              AND n.version_sequence_number<=? ORDER BY n.version_sequence_number DESC LIMIT 1) n ON true
            LEFT JOIN LATERAL (SELECT * FROM token_value_revisions r WHERE r.token_value_id=v.id
              AND r.version_sequence_number<=? AND NOT(r.design_system_version_id=? AND r.token_value_id=ANY(?))
              ORDER BY r.version_sequence_number DESC LIMIT 1) r ON NOT r.deleted
            ORDER BY m.id,v.id
            """.trimIndent(),
            sequence, owner, jdbc.texts(names), owner, jdbc.uuids(knownMembers),
            sequence, sequence, draft, jdbc.uuids(ids),
        ).filter { row -> specs.any { it.memberOf(ThemeTokenType.COLOR, row["name"].orEmpty()) } }
    }

    private fun matchingFamilyTypes(rows: List<Map<String, String?>>): Boolean {
        val keys = rows.distinctBy { it["id"] }.associate { row ->
            val family = ColorTokenFamily.of(ThemeTokenType.fromWire(row["type"])!!, row["name"].orEmpty())
                ?: return false
            row["id"] to (family.group to family.name)
        }
        return rows.groupBy { keys[it["id"]] }.values.all { group ->
            val values = group.mapNotNull { row ->
                if (row["tenant_deleted"] !in FALSE) return@mapNotNull null
                val value = row["value"] ?: return@mapNotNull null
                val platform = ThemeTokenPlatform.entries.firstOrNull { it.wireValue == row["platform"] }
                    ?: return@mapNotNull null
                FamilyValue(platform, Json.parseToJsonElement(value))
            }
            val type = ColorTokenFamilyType.of(values).wireValue
            group.all { it["type"] == type }
        }
    }

    private companion object {
        val FALSE = setOf("f", "false")
    }
}
