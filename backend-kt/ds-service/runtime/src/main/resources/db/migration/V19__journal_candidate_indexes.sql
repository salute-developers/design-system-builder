-- Отбираем кандидатов журнала до чтения и сравнения прежних и текущих значений.
CREATE INDEX token_value_revisions_owner_sequence_idx
    ON token_value_revisions (design_system_id, version_sequence_number, token_value_id);
CREATE INDEX token_revisions_owner_sequence_idx
    ON token_revisions (design_system_id, version_sequence_number, token_id);
