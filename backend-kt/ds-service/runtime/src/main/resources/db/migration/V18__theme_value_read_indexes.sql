-- Чтение значений темы начинается с темы и дизайн-системы, а не с токена (change update-figma-export-speed):
-- уникальные индексы token_values начинаются с token_id, индекс границы ревизий — с token_value_id, и запрос
-- значений одной темы проходил ревизии всей базы. Данные не меняются. Обратная миграция для отката ds-service:
--   DROP INDEX IF EXISTS token_values_tenant_token_idx;
--   DROP INDEX IF EXISTS token_value_revisions_design_system_idx;

CREATE INDEX IF NOT EXISTS token_values_tenant_token_idx ON token_values (tenant_id, token_id);
CREATE INDEX IF NOT EXISTS token_value_revisions_design_system_idx
    ON token_value_revisions (design_system_id, token_value_id, version_sequence_number DESC);
