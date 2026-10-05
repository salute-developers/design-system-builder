-- Copy values for custom tokens from the earliest theme of the same design system.
-- Standard seed values already exist; this only completes values absent from a theme.
WITH base_themes AS (
    SELECT DISTINCT ON (design_system_id) id, design_system_id
    FROM tenants
    ORDER BY design_system_id, created_at, id
)
INSERT INTO token_values (id, token_id, tenant_id, palette_id, platform, mode, value, created_at, updated_at)
SELECT gen_random_uuid(), source.token_id, target.id, source.palette_id, source.platform, source.mode,
       source.value, NOW(), NOW()
FROM tenants target
JOIN base_themes base ON base.design_system_id = target.design_system_id
JOIN token_values source ON source.tenant_id = base.id
WHERE target.id <> base.id
  AND NOT EXISTS (
      SELECT 1
      FROM token_values existing
      WHERE existing.tenant_id = target.id
        AND existing.token_id = source.token_id
  );
