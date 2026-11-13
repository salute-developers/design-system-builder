WITH scope AS (
    SELECT ?::uuid AS owner, ?::uuid AS boundary, ?::bigint AS current_seq,
           ?::bigint AS previous_seq, ?::uuid AS tenant, ?::uuid AS after_id
), changed AS MATERIALIZED (
    SELECT DISTINCT revision.token_value_id
    FROM token_value_revisions revision CROSS JOIN scope
    WHERE revision.design_system_id = scope.owner
      AND revision.version_sequence_number > scope.previous_seq
      AND revision.version_sequence_number <= scope.current_seq
), new_tenants AS MATERIALIZED (
    SELECT entity.id FROM tenants entity CROSS JOIN scope
    LEFT JOIN LATERAL (
        SELECT tenant_id, deleted FROM tenant_revisions revision
        WHERE revision.tenant_id = entity.id AND revision.version_sequence_number <= scope.previous_seq
        ORDER BY revision.version_sequence_number DESC LIMIT 1
    ) previous ON true
    JOIN LATERAL (
        SELECT tenant_id, deleted FROM tenant_revisions revision
        WHERE revision.tenant_id = entity.id AND revision.version_sequence_number <= scope.current_seq
        ORDER BY revision.version_sequence_number DESC LIMIT 1
    ) current ON NOT current.deleted
    WHERE entity.design_system_id = scope.owner
      AND (scope.tenant IS NULL OR entity.id = scope.tenant)
      AND (previous.tenant_id IS NULL OR previous.deleted)
)
SELECT entity.id FROM changed
JOIN token_values entity ON entity.id = changed.token_value_id
CROSS JOIN scope
LEFT JOIN new_tenants parent ON parent.id = entity.tenant_id
LEFT JOIN LATERAL (
    SELECT token_value_id, deleted FROM token_value_revisions revision
    WHERE revision.token_value_id = entity.id AND revision.version_sequence_number <= scope.previous_seq
    ORDER BY revision.version_sequence_number DESC LIMIT 1
) previous ON true
LEFT JOIN LATERAL (
    SELECT token_value_id, palette_id, value, overridden, deleted FROM token_value_revisions revision
    WHERE revision.token_value_id = entity.id AND revision.version_sequence_number <= scope.current_seq
    ORDER BY revision.version_sequence_number DESC LIMIT 1
) current ON true
LEFT JOIN token_value_creation_baselines baseline ON baseline.token_value_id = entity.id
    AND baseline.design_system_version_id = scope.boundary AND baseline.design_system_id = scope.owner
WHERE entity.design_system_id = scope.owner
  AND (scope.tenant IS NULL OR entity.tenant_id = scope.tenant)
  AND (scope.after_id IS NULL OR entity.id > scope.after_id)
  AND NOT (
      parent.id IS NOT NULL AND (previous.token_value_id IS NULL OR previous.deleted)
      AND current.token_value_id IS NOT NULL AND NOT current.deleted
      AND baseline.token_value_id IS NOT NULL
      AND current.palette_id IS NOT DISTINCT FROM baseline.palette_id
      AND COALESCE(current.value, 'null'::jsonb)::text IS NOT DISTINCT FROM COALESCE(baseline.value, 'null'::jsonb)::text
      AND current.overridden IS NOT DISTINCT FROM baseline.overridden
  )
ORDER BY entity.id LIMIT 500
