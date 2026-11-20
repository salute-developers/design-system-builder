package com.dsbuilder.ds.themes.data

import com.dsbuilder.ds.core.application.DraftValueBatchRequest
import com.dsbuilder.ds.core.data.BatchJdbc
import com.dsbuilder.ds.themes.domain.colortokens.ColorTokenFamily
import java.util.UUID

/** SQL-проекции пакетного отката: отдельные формы снимка, определения и восстановленного значения. */
internal class LiteralValueBatchReader(private val jdbc: BatchJdbc) {
    fun snapshot(request: DraftValueBatchRequest): List<LiteralValueSnapshot> = jdbc.read(
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
        decode = ::literalValueSnapshot,
    )

    fun members(owner: UUID, sequence: Long, specs: Set<ColorTokenFamily>): List<LiteralFamilyMember> {
        if (specs.isEmpty()) return emptyList()
        val names = specs.flatMap { it.candidateNames() }.toSet()
        return jdbc.read(
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
            decode = ::literalFamilyMember,
        ).filter { row -> specs.any { it.memberOf(row.type, row.name) } }
    }

    fun restoredValues(
        owner: UUID,
        sequence: Long,
        draft: UUID,
        ids: List<UUID>,
        specs: Set<ColorTokenFamily>,
        members: List<UUID>,
    ): List<RestoredFamilyValue> {
        if (specs.isEmpty()) return emptyList()
        val names = specs.flatMap { it.candidateNames() }.toSet()
        return jdbc.read(
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
            sequence, owner, jdbc.texts(names), owner, jdbc.uuids(members),
            sequence, sequence, draft, jdbc.uuids(ids),
            decode = ::restoredFamilyValue,
        ).filter { row -> specs.any { it.memberOf(row.member.type, row.member.name) } }
    }
}
