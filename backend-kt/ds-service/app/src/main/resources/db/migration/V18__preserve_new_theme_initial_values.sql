-- Начальные значения темы образуют локальную исходную точку для изменений,
-- выполненных до первой публикации. Это не граница версии дизайн-системы.
CREATE TABLE token_value_creation_baselines (
    design_system_version_id uuid NOT NULL,
    token_value_id uuid NOT NULL,
    design_system_id uuid NOT NULL,
    palette_id uuid,
    value jsonb,
    PRIMARY KEY (design_system_version_id, token_value_id),
    CONSTRAINT token_value_creation_baselines_value_fk
        FOREIGN KEY (token_value_id, design_system_id)
        REFERENCES token_values (id, design_system_id) ON DELETE CASCADE,
    CONSTRAINT token_value_creation_baselines_version_fk
        FOREIGN KEY (design_system_version_id, design_system_id)
        REFERENCES design_system_versions (id, design_system_id) ON DELETE CASCADE,
    CONSTRAINT token_value_creation_baselines_palette_fk
        FOREIGN KEY (palette_id) REFERENCES palette (id) ON DELETE RESTRICT
);

CREATE INDEX token_value_creation_baselines_design_system_idx
    ON token_value_creation_baselines (design_system_id, design_system_version_id);

-- Для уже существующих активных черновиков дальнейшие изменения сравниваются
-- с состоянием на момент применения миграции. Ранее выполненные изменения
-- нельзя надёжно отделить от служебного начального наполнения задним числом.
INSERT INTO token_value_creation_baselines (
    design_system_version_id,
    token_value_id,
    design_system_id,
    palette_id,
    value
)
SELECT
    boundary.id,
    value.id,
    value.design_system_id,
    revision.palette_id,
    revision.value
FROM design_system_versions boundary
JOIN tenant_revisions tenant_revision
  ON tenant_revision.design_system_version_id = boundary.id
 AND tenant_revision.design_system_id = boundary.design_system_id
 AND NOT tenant_revision.deleted
JOIN tenants tenant
  ON tenant.id = tenant_revision.tenant_id
 AND tenant.design_system_id = boundary.design_system_id
JOIN token_values value
  ON value.tenant_id = tenant.id
 AND value.design_system_id = boundary.design_system_id
JOIN token_value_revisions revision
  ON revision.token_value_id = value.id
 AND revision.design_system_version_id = boundary.id
 AND revision.design_system_id = boundary.design_system_id
 AND NOT revision.deleted
WHERE boundary.status = 'draft'
  AND NOT EXISTS (
      SELECT 1
      FROM tenant_revisions earlier
      WHERE earlier.tenant_id = tenant.id
        AND earlier.design_system_id = boundary.design_system_id
        AND earlier.version_sequence_number < boundary.sequence_number
  )
ON CONFLICT DO NOTHING;
