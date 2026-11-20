-- Ожидаемая система задаётся приложением локально для предметной транзакции.
CREATE FUNCTION ds_request_matches_design_system(owner_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('ds.design_system_id', true), '') IS NULL
        OR owner_id = NULLIF(current_setting('ds.design_system_id', true), '')::uuid
$$;
