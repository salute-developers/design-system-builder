-- Проверки действуют на разрешённое состояние, включая унаследованные редакции.
-- V7 не переписывается: уже применённые контрольные суммы остаются прежними.
CREATE OR REPLACE FUNCTION enforce_palette_revision_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    owner uuid := COALESCE(NEW.design_system_id, OLD.design_system_id);
    boundary_sequence bigint := COALESCE(NEW.version_sequence_number, OLD.version_sequence_number);
    problem text;
    validation_key text := owner::text || ':' || boundary_sequence::text;
    checked text[] := COALESCE(string_to_array(NULLIF(current_setting('ds.palette_checked_boundaries', true), ''), ','), ARRAY[]::text[]);
BEGIN
    IF TG_TABLE_NAME = 'token_revisions' AND revision_integrity_keys_unchanged(
        'tokens', TG_RELID::regclass, 'token_id', boundary_sequence,
        to_jsonb(COALESCE(NEW, OLD)), TG_OP, ARRAY['group_id']
    ) THEN RETURN NULL; END IF;
    -- Пакетная операция проверяет итоговый граф один раз, а не по разу на каждую редакцию.
    IF validation_key = ANY(checked) THEN RETURN NULL; END IF;
    WITH
    pg_latest AS (
        SELECT DISTINCT ON (g.id) g.id, g.tenant_id, r.label, r.deleted
        FROM tenant_palette_groups g JOIN tenant_palette_group_revisions r ON r.group_id = g.id
        WHERE g.design_system_id = owner AND r.version_sequence_number <= boundary_sequence
        ORDER BY g.id, r.version_sequence_number DESC
    ),
    pg AS (SELECT * FROM pg_latest WHERE NOT deleted),
    ramp_latest AS (
        SELECT DISTINCT ON (s.id) s.id, s.group_id, r.deleted FROM tenant_palette_ramps s
        JOIN tenant_palette_ramp_revisions r ON r.ramp_id = s.id
        WHERE s.design_system_id = owner AND r.version_sequence_number <= boundary_sequence
        ORDER BY s.id, r.version_sequence_number DESC
    ),
    ramps AS (SELECT * FROM ramp_latest WHERE NOT deleted),
    step_latest AS (
        SELECT DISTINCT ON (s.id) s.ramp_id, r.deleted FROM tenant_palette_steps s
        JOIN tenant_palette_step_revisions r ON r.step_id = s.id
        WHERE s.design_system_id = owner AND r.version_sequence_number <= boundary_sequence
        ORDER BY s.id, r.version_sequence_number DESC
    ),
    assignment_latest AS (
        SELECT DISTINCT ON (s.id) s.tenant_id, s.token_id, r.group_id, r.deleted FROM tenant_palette_token_groups s
        JOIN tenant_palette_token_group_revisions r ON r.assignment_id = s.id
        WHERE s.design_system_id = owner AND r.version_sequence_number <= boundary_sequence
        ORDER BY s.id, r.version_sequence_number DESC
    ),
    group_latest AS (
        SELECT DISTINCT ON (s.id) s.id, s.kind, r.parent_id, r.code, r.label, r.deleted FROM token_groups s
        JOIN token_group_revisions r ON r.group_id = s.id
        WHERE s.design_system_id = owner AND r.version_sequence_number <= boundary_sequence
        ORDER BY s.id, r.version_sequence_number DESC
    ),
    groups AS (SELECT * FROM group_latest WHERE NOT deleted),
    token_latest AS (
        SELECT DISTINCT ON (s.id) s.id, r.group_id, r.deleted FROM tokens s
        JOIN token_revisions r ON r.token_id = s.id
        WHERE s.design_system_id = owner AND r.version_sequence_number <= boundary_sequence
        ORDER BY s.id, r.version_sequence_number DESC
    ),
    problems AS (
        SELECT 'unique_palette_group_label' AS reason FROM pg GROUP BY tenant_id, lower(label) HAVING count(*) > 1
        UNION ALL
        SELECT 'unique_token_group_label' FROM groups GROUP BY kind, parent_id, lower(label) HAVING count(*) > 1
        UNION ALL
        SELECT 'invalid_token_group_shape' FROM groups WHERE btrim(label) = ''
            OR (parent_id IS NULL) <> (code IS NOT NULL) OR (code IS NOT NULL AND code !~ '^[a-z0-9]+(-[a-z0-9]+)*$')
        UNION ALL
        SELECT 'missing_palette_group' FROM ramps r WHERE NOT EXISTS (SELECT 1 FROM pg WHERE pg.id = r.group_id)
        UNION ALL
        SELECT 'missing_palette_ramp' FROM step_latest s WHERE NOT s.deleted
            AND NOT EXISTS (SELECT 1 FROM ramps r WHERE r.id = s.ramp_id)
        UNION ALL
        SELECT 'missing_palette_assignment_group' FROM assignment_latest a WHERE NOT a.deleted
            AND NOT EXISTS (SELECT 1 FROM pg WHERE pg.id = a.group_id AND pg.tenant_id = a.tenant_id)
        UNION ALL
        SELECT 'missing_token_group_parent' FROM groups child WHERE child.parent_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM groups parent WHERE parent.id = child.parent_id AND parent.parent_id IS NULL AND parent.kind = child.kind)
        UNION ALL
        SELECT 'missing_token_group' FROM token_latest t WHERE NOT t.deleted AND t.group_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM groups g WHERE g.id = t.group_id)
    )
    SELECT reason INTO problem FROM problems LIMIT 1;
    IF problem IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = CASE WHEN problem LIKE 'unique_%' THEN '23505' ELSE '23503' END,
            MESSAGE = problem;
    END IF;
    PERFORM set_config('ds.palette_checked_boundaries', array_to_string(array_append(checked, validation_key), ','), true);
    RETURN NULL;
END;
$$;
CREATE FUNCTION resolved_integrity_rows(
    stable_table regclass, revision_table regclass, entity_column text, owner uuid, boundary bigint
) RETURNS SETOF jsonb LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY EXECUTE format(
        'SELECT to_jsonb(s) || to_jsonb(r) || jsonb_build_object(''id'', s.id) '
        || 'FROM %s s JOIN LATERAL (SELECT candidate.* FROM %s candidate '
        || 'WHERE candidate.%I = s.id AND candidate.version_sequence_number <= $2 '
        || 'ORDER BY candidate.version_sequence_number DESC LIMIT 1) r ON true '
        || 'WHERE s.design_system_id = $1 AND NOT r.deleted',
        stable_table, revision_table, entity_column
    ) USING owner, boundary;
END;
$$;

CREATE FUNCTION clear_revision_integrity_checks() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    previous_rows jsonb := COALESCE(NULLIF(current_setting('ds.revision_integrity_previous', true), ''), '{}')::jsonb;
    entity_column text := regexp_replace(TG_TABLE_NAME, '_revisions$', '') || '_id';
    cache_key text;
    previous_keys jsonb;
    current_rows jsonb := COALESCE(NULLIF(current_setting('ds.revision_integrity_current', true), ''), '{}')::jsonb;
BEGIN
    -- SET CONSTRAINTS IMMEDIATE может быть вызван до следующей записи в той же транзакции.
    PERFORM set_config('ds.revision_integrity_checked', '', true);
    PERFORM set_config('ds.palette_checked_boundaries', '', true);
    cache_key := TG_RELID::text || ':' || (to_jsonb(COALESCE(NEW, OLD))->>entity_column)
        || ':' || COALESCE(NEW.version_sequence_number, OLD.version_sequence_number)::text;
    SELECT jsonb_object_agg(key, value) INTO previous_keys FROM jsonb_each(to_jsonb(COALESCE(NEW, OLD)))
    WHERE key = ANY(ARRAY['deleted', 'name', 'group_id', 'appearance_id', 'variation_id', 'component_dep_id',
        'position', 'style_id', 'property_id', 'component_id', 'combination_key', 'state_set_id',
        'combination_id', 'appearance_variation_id', 'appearance_combination_id', 'reference_id',
        'invariant_property_value_id', 'variation_property_value_id', 'style_combination_id']);
    PERFORM set_config('ds.revision_integrity_current',
        (current_rows || jsonb_build_object(cache_key, CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE previous_keys END))::text, true);
    IF TG_OP = 'DELETE' THEN
        IF NOT previous_rows ? cache_key THEN
            -- Сохраняются только ключи первой заменённой редакции, без значений токенов.
            PERFORM set_config('ds.revision_integrity_previous',
                (previous_rows || jsonb_build_object(cache_key, previous_keys))::text, true);
        END IF;
    ELSIF NOT previous_rows ? cache_key THEN
        -- Вставка раньше удаления означает новую черновую редакцию в этой транзакции.
        -- Её последующая замена не должна скрыть первичную проверку уникальности.
        PERFORM set_config('ds.revision_integrity_previous',
            (previous_rows || jsonb_build_object(cache_key, NULL))::text, true);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Правка значения/описания не перечитывает чужие сущности ради неизменившегося уникального ключа.
CREATE FUNCTION revision_integrity_keys_unchanged(
    stable_table regclass, revision_table regclass, entity_column text, boundary bigint,
    changed_row jsonb, operation text, key_fields text[]
) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE previous jsonb; current_value jsonb;
    cache_key text := revision_table::oid::text || ':' || (changed_row->>entity_column) || ':' || boundary::text;
BEGIN
    current_value := COALESCE(NULLIF(current_setting('ds.revision_integrity_current', true), ''), '{}')::jsonb -> cache_key;
    -- При удалении редакции снова действует унаследованная: её ключи всё ещё нужно проверить.
    IF current_value IS NULL OR current_value = 'null'::jsonb THEN EXECUTE format(
        'SELECT to_jsonb(s) || to_jsonb(r) FROM %s s JOIN LATERAL '
        || '(SELECT candidate.* FROM %s candidate WHERE candidate.%I = s.id '
        || 'AND candidate.version_sequence_number <= $2 ORDER BY candidate.version_sequence_number DESC LIMIT 1) r ON true '
        || 'WHERE s.id = $1', stable_table, revision_table, entity_column
    ) INTO current_value USING (changed_row->>entity_column)::uuid, boundary;
    END IF;
    IF current_value IS NULL OR (current_value->>'deleted')::boolean THEN RETURN true; END IF;
    IF operation = 'DELETE' THEN
        previous := changed_row;
    ELSE
        previous := COALESCE(NULLIF(current_setting('ds.revision_integrity_previous', true), ''), '{}')::jsonb
            -> cache_key;
        IF previous IS NULL OR previous = 'null'::jsonb THEN EXECUTE format(
            'SELECT to_jsonb(r) FROM %s r WHERE r.%I = $1 AND r.version_sequence_number < $2 '
            || 'ORDER BY r.version_sequence_number DESC LIMIT 1', revision_table, entity_column
        ) INTO previous USING (changed_row->>entity_column)::uuid, boundary;
        END IF;
    END IF;
    IF previous IS NULL OR (previous->>'deleted')::boolean THEN RETURN false; END IF;
    -- Неизменяемые столбцы владельца отсутствуют в редакции, но не могут измениться этой операцией.
    RETURN NOT EXISTS (SELECT 1 FROM unnest(key_fields) key
        WHERE previous ? key AND previous->key IS DISTINCT FROM current_value->key);
END;
$$;

CREATE FUNCTION enforce_resolved_revision_unique() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    owner uuid := COALESCE(NEW.design_system_id, OLD.design_system_id);
    boundary bigint := COALESCE(NEW.version_sequence_number, OLD.version_sequence_number);
    validation_key text := owner::text || ':' || boundary::text || ':' || TG_NAME;
    checked text[] := COALESCE(string_to_array(NULLIF(current_setting('ds.revision_integrity_checked', true), ''), ','), ARRAY[]::text[]);
    group_columns text;
    present_columns text;
    duplicate boolean;
BEGIN
    IF revision_integrity_keys_unchanged(TG_ARGV[0]::regclass, TG_RELID::regclass, TG_ARGV[1], boundary,
        to_jsonb(COALESCE(NEW, OLD)), TG_OP, string_to_array(TG_ARGV[2], ',')) THEN RETURN NULL; END IF;
    IF validation_key = ANY(checked) THEN RETURN NULL; END IF;
    IF TG_ARGV[0] = 'design_systems' THEN
        WITH latest AS (
            SELECT DISTINCT ON (design_system_id) name, deleted
            FROM design_system_revisions
            ORDER BY design_system_id, version_sequence_number DESC
        )
        SELECT EXISTS (SELECT 1 FROM latest WHERE NOT deleted AND name IS NOT NULL
            GROUP BY name HAVING count(*) > 1) INTO duplicate;
    ELSE
        SELECT string_agg(CASE WHEN TG_ARGV[0] = 'tenants' AND key = 'name'
                    THEN format('lower(payload->>%L)', key) ELSE format('payload->>%L', key) END, ', '),
               string_agg(format('payload->>%L IS NOT NULL', key), ' AND ')
        INTO group_columns, present_columns
        FROM unnest(string_to_array(TG_ARGV[2], ',')) key;
        IF TG_ARGV[0] = 'appearances' THEN present_columns := 'true'; END IF;
        EXECUTE format(
            'SELECT EXISTS (SELECT 1 FROM resolved_integrity_rows($1, $2, $3, $4, $5) payload '
            || 'WHERE %s GROUP BY %s HAVING count(*) > 1)', present_columns, group_columns
        ) INTO duplicate USING TG_ARGV[0]::regclass, TG_RELID::regclass, TG_ARGV[1], owner, boundary;
    END IF;
    IF duplicate THEN
        RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = TG_NAME, CONSTRAINT = TG_NAME;
    END IF;
    PERFORM set_config('ds.revision_integrity_checked', array_to_string(array_append(checked, validation_key), ','), true);
    RETURN NULL;
END;
$$;

DO $$
DECLARE item record;
BEGIN
    FOR item IN SELECT * FROM (VALUES
        ('design_systems', 'design_system_revisions', 'design_system_id', 'name', 'design_systems_name_unique'),
        ('tenants', 'tenant_revisions', 'tenant_id', 'name', 'tenant_resolved_name_unique'),
        ('tokens', 'token_revisions', 'token_id', 'name', 'token_resolved_name_unique'),
        ('appearances', 'appearance_revisions', 'appearance_id', 'component_id,name', 'appearance_resolved_name_unique'),
        ('styles', 'style_revisions', 'style_id', 'variation_id,name', 'style_resolved_name_unique'),
        ('component_reuse_configs', 'component_reuse_config_revisions', 'component_reuse_config_id', 'component_dep_id,appearance_id,variation_id', 'crc_resolved_slot_unique'),
        ('appearance_variations', 'appearance_variation_revisions', 'appearance_variation_id', 'appearance_id,position', 'av_resolved_position_unique'),
        ('appearance_variation_values', 'appearance_variation_value_revisions', 'appearance_variation_value_id', 'appearance_variation_id,style_id', 'avv_resolved_style_unique'),
        ('appearance_variation_values', 'appearance_variation_value_revisions', 'appearance_variation_value_id', 'appearance_variation_id,position', 'avv_resolved_position_unique'),
        ('appearance_combinations', 'appearance_combination_revisions', 'appearance_combination_id', 'appearance_id,combination_key', 'ac_resolved_key_unique'),
        ('appearance_combinations', 'appearance_combination_revisions', 'appearance_combination_id', 'appearance_id,position', 'ac_resolved_position_unique'),
        ('appearance_combination_members', 'appearance_combination_member_revisions', 'appearance_combination_member_id', 'appearance_combination_id,style_id', 'acm_resolved_style_unique'),
        ('appearance_combination_members', 'appearance_combination_member_revisions', 'appearance_combination_member_id', 'appearance_combination_id,position', 'acm_resolved_position_unique'),
        ('invariant_property_values', 'invariant_property_value_revisions', 'invariant_property_value_id', 'component_id,property_id,appearance_id,state_set_id', 'ipv_resolved_slot_unique'),
        ('variation_property_values', 'variation_property_value_revisions', 'variation_property_value_id', 'style_id,property_id,appearance_id,state_set_id', 'vpv_resolved_slot_unique'),
        ('style_combinations', 'style_combination_revisions', 'style_combination_id', 'property_id,appearance_id,combination_key,state_set_id', 'sc_resolved_slot_unique'),
        ('style_combination_members', 'style_combination_member_revisions', 'style_combination_member_id', 'combination_id,style_id', 'scm_resolved_style_unique'),
        ('component_style_references', 'component_style_reference_revisions', 'component_style_reference_id', 'invariant_property_value_id', 'csr_resolved_invariant_unique'),
        ('component_style_references', 'component_style_reference_revisions', 'component_style_reference_id', 'variation_property_value_id', 'csr_resolved_variation_unique'),
        ('component_style_references', 'component_style_reference_revisions', 'component_style_reference_id', 'style_combination_id', 'csr_resolved_combination_unique'),
        ('component_style_reference_styles', 'component_style_reference_style_revisions', 'component_style_reference_style_id', 'reference_id,style_id', 'csrs_resolved_style_unique')
    ) AS rules(stable_table, revision_table, entity_column, key_columns, constraint_name) LOOP
        EXECUTE format('CREATE CONSTRAINT TRIGGER %I AFTER INSERT OR DELETE ON %I '
            || 'DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_resolved_revision_unique(%L, %L, %L)',
            item.constraint_name, item.revision_table, item.stable_table, item.entity_column, item.key_columns);
    END LOOP;
    FOR item IN SELECT DISTINCT event_object_table AS revision_table FROM information_schema.triggers
        WHERE trigger_schema = 'public' AND action_statement LIKE '%enforce_resolved_revision_unique%'
    LOOP
        EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR DELETE ON %I FOR EACH ROW '
            || 'EXECUTE FUNCTION clear_revision_integrity_checks()',
            item.revision_table || '_reset_integrity', item.revision_table);
    END LOOP;
END;
$$;

CREATE FUNCTION enforce_resolved_state_set_coherence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    owner uuid := COALESCE(NEW.design_system_id, OLD.design_system_id);
    boundary bigint := COALESCE(NEW.version_sequence_number, OLD.version_sequence_number);
    validation_key text := owner::text || ':' || boundary::text || ':state_set_coherence';
    checked text[] := COALESCE(string_to_array(NULLIF(current_setting('ds.revision_integrity_checked', true), ''), ','), ARRAY[]::text[]);
    invalid boolean;
    stable_table text;
    entity_column text;
BEGIN
    SELECT stable_name, entity_name INTO stable_table, entity_column FROM (VALUES
        ('invariant_property_value_revisions', 'invariant_property_values', 'invariant_property_value_id'),
        ('variation_property_value_revisions', 'variation_property_values', 'variation_property_value_id'),
        ('style_combination_revisions', 'style_combinations', 'style_combination_id'),
        ('style_combination_member_revisions', 'style_combination_members', 'style_combination_member_id')
    ) AS mapping(revision_name, stable_name, entity_name) WHERE revision_name = TG_TABLE_NAME;
    IF revision_integrity_keys_unchanged(stable_table::regclass, TG_RELID::regclass, entity_column, boundary,
        to_jsonb(COALESCE(NEW, OLD)), TG_OP,
        CASE WHEN TG_TABLE_NAME = 'style_combination_member_revisions' THEN ARRAY['style_id'] ELSE ARRAY['state_set_id'] END
    ) THEN RETURN NULL; END IF;
    IF validation_key = ANY(checked) THEN RETURN NULL; END IF;
    WITH values_with_component AS (
        SELECT (p->>'state_set_id')::uuid AS set_id, (p->>'component_id')::uuid AS component_id
        FROM resolved_integrity_rows('invariant_property_values', 'invariant_property_value_revisions',
            'invariant_property_value_id', owner, boundary) p
        UNION ALL
        SELECT (p->>'state_set_id')::uuid, v.component_id
        FROM resolved_integrity_rows('variation_property_values', 'variation_property_value_revisions',
            'variation_property_value_id', owner, boundary) p
        JOIN styles s ON s.id = (p->>'style_id')::uuid JOIN variations v ON v.id = s.variation_id
        UNION ALL
        SELECT (combination->>'state_set_id')::uuid, v.component_id
        FROM resolved_integrity_rows('style_combinations', 'style_combination_revisions',
            'style_combination_id', owner, boundary) combination
        JOIN resolved_integrity_rows('style_combination_members', 'style_combination_member_revisions',
            'style_combination_member_id', owner, boundary) member
            ON member->>'combination_id' = combination->>'id'
        JOIN styles s ON s.id = (member->>'style_id')::uuid JOIN variations v ON v.id = s.variation_id
    )
    SELECT EXISTS (SELECT 1 FROM values_with_component value JOIN state_sets ss ON ss.id = value.set_id
        WHERE ss.owner_component_id IS NOT NULL AND ss.owner_component_id IS DISTINCT FROM value.component_id)
    INTO invalid;
    IF invalid THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'state_set_component_mismatch',
            CONSTRAINT = 'resolved_state_set_coherent';
    END IF;
    PERFORM set_config('ds.revision_integrity_checked', array_to_string(array_append(checked, validation_key), ','), true);
    RETURN NULL;
END;
$$;

DO $$
DECLARE revision_table text;
BEGIN
    FOREACH revision_table IN ARRAY ARRAY['invariant_property_value_revisions', 'variation_property_value_revisions',
        'style_combination_revisions', 'style_combination_member_revisions'] LOOP
        EXECUTE format('CREATE CONSTRAINT TRIGGER %I AFTER INSERT OR DELETE ON %I '
            || 'DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_resolved_state_set_coherence()',
            revision_table || '_state_set_coherent', revision_table);
    END LOOP;
END;
$$;
