-- Source: Drizzle 0006_military_mephisto.sql; Flyway owns the transaction.
LOCK TABLE "public"."tenants" IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  conflicting_design_system uuid;
BEGIN
  SELECT "design_system_id" INTO conflicting_design_system
  FROM "public"."tenants"
  WHERE "name" IS NOT NULL
  GROUP BY "design_system_id", lower(regexp_replace(btrim("name"), '\s+', ' ', 'g'))
  HAVING count(*) > 1
  ORDER BY "design_system_id"
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Conflicting normalized tenant names: design_system_id=%', conflicting_design_system
      USING HINT = 'Resolve duplicate names after whitespace normalization and lower(name), then retry the migration.';
  END IF;
END;
$$;

DROP INDEX "public"."tenants_design_system_id_name_unique";
ALTER TABLE "public"."tenants" ADD COLUMN "edit_revision" integer DEFAULT 0 NOT NULL;
UPDATE "public"."tenants"
SET "name" = regexp_replace(btrim("name"), '\s+', ' ', 'g')
WHERE "name" IS NOT NULL;
CREATE UNIQUE INDEX "tenants_design_system_id_name_ci_unique"
  ON "public"."tenants" USING btree ("design_system_id", lower("name"));

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
