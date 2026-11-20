-- Окно первичного наполнения базовой версии новой дизайн-системы.
-- Пока окно открыто, построчные триггеры на *_revisions не вызываются (условие WHEN),
-- а при закрытии целостность разрешённого состояния проверяется один раз теми же правилами.
-- DROP TRIGGER для constraint-триггеров берёт ACCESS EXCLUSIVE: не ждём занятые таблицы бесконечно.
SET LOCAL lock_timeout = '5s';

-- Правило занятого имени в одном месте: последняя по sequence редакция другой системы не удалена
-- и её имя совпадает точно, с учётом регистра (как в V10). Проверка глобальная, по всем проектам.
CREATE FUNCTION design_system_name_taken(candidate text, except_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM design_systems system JOIN LATERAL (
            SELECT name, deleted FROM design_system_revisions revision
            WHERE revision.design_system_id = system.id
            ORDER BY version_sequence_number DESC LIMIT 1
        ) resolved ON true
        WHERE (except_id IS NULL OR system.id <> except_id)
          AND NOT resolved.deleted AND resolved.name = candidate
    )
$$;

CREATE OR REPLACE FUNCTION enforce_resolved_design_system_name_unique() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    owner uuid := COALESCE(NEW.design_system_id, OLD.design_system_id);
    boundary bigint := COALESCE(NEW.version_sequence_number, OLD.version_sequence_number);
    candidate_name text;
    candidate_deleted boolean;
BEGIN
    IF revision_integrity_keys_unchanged('design_systems', TG_RELID::regclass, 'design_system_id', boundary,
        to_jsonb(COALESCE(NEW, OLD)), TG_OP, ARRAY['name']) THEN RETURN NULL; END IF;
    SELECT name, deleted INTO candidate_name, candidate_deleted FROM design_system_revisions
        WHERE design_system_id = owner AND version_sequence_number <= boundary
        ORDER BY version_sequence_number DESC LIMIT 1;
    IF NOT FOUND OR candidate_deleted OR candidate_name IS NULL THEN RETURN NULL; END IF;
    IF design_system_name_taken(candidate_name, owner) THEN
        RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'design_systems_name_unique',
            CONSTRAINT = 'design_systems_name_unique';
    END IF;
    RETURN NULL;
END;
$$;

-- Проверки целостности вынесены из триггеров, чтобы их можно было вызвать один раз на границу.
-- Имя ограничения передаётся явно: по нему PostgresTransactionFailureMapper различает конфликты.
CREATE FUNCTION check_resolved_revision_unique(
    stable_table text, revision_table regclass, entity_column text, key_fields text,
    owner uuid, boundary bigint, constraint_name text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    group_columns text;
    present_columns text;
    duplicate boolean;
BEGIN
    IF stable_table = 'design_systems' THEN
        WITH latest AS (
            SELECT DISTINCT ON (design_system_id) name, deleted
            FROM design_system_revisions
            ORDER BY design_system_id, version_sequence_number DESC
        )
        SELECT EXISTS (SELECT 1 FROM latest WHERE NOT deleted AND name IS NOT NULL
            GROUP BY name HAVING count(*) > 1) INTO duplicate;
    ELSE
        SELECT string_agg(CASE WHEN stable_table = 'tenants' AND key = 'name'
                    THEN format('lower(payload->>%L)', key) ELSE format('payload->>%L', key) END, ', '),
               string_agg(format('payload->>%L IS NOT NULL', key), ' AND ')
        INTO group_columns, present_columns
        FROM unnest(string_to_array(key_fields, ',')) key;
        IF stable_table = 'appearances' THEN present_columns := 'true'; END IF;
        EXECUTE format(
            'SELECT EXISTS (SELECT 1 FROM resolved_integrity_rows($1, $2, $3, $4, $5) payload '
            || 'WHERE %s GROUP BY %s HAVING count(*) > 1)', present_columns, group_columns
        ) INTO duplicate USING stable_table::regclass, revision_table, entity_column, owner, boundary;
    END IF;
    IF duplicate THEN
        RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = constraint_name, CONSTRAINT = constraint_name;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_resolved_revision_unique() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    owner uuid := COALESCE(NEW.design_system_id, OLD.design_system_id);
    boundary bigint := COALESCE(NEW.version_sequence_number, OLD.version_sequence_number);
    validation_key text := owner::text || ':' || boundary::text || ':' || TG_NAME;
    checked text[] := COALESCE(string_to_array(NULLIF(current_setting('ds.revision_integrity_checked', true), ''), ','), ARRAY[]::text[]);
BEGIN
    IF validation_key = ANY(checked) THEN RETURN NULL; END IF;
    IF revision_integrity_keys_unchanged(TG_ARGV[0]::regclass, TG_RELID::regclass, TG_ARGV[1], boundary,
        to_jsonb(COALESCE(NEW, OLD)), TG_OP, string_to_array(TG_ARGV[2], ',')) THEN RETURN NULL; END IF;
    PERFORM check_resolved_revision_unique(TG_ARGV[0], TG_RELID::regclass, TG_ARGV[1], TG_ARGV[2],
        owner, boundary, TG_NAME);
    PERFORM set_config('ds.revision_integrity_checked', array_to_string(array_append(checked, validation_key), ','), true);
    RETURN NULL;
END;
$$;

CREATE FUNCTION check_resolved_state_set_coherence(owner uuid, boundary bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    invalid boolean;
BEGIN
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
END;
$$;

CREATE OR REPLACE FUNCTION enforce_resolved_state_set_coherence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    owner uuid := COALESCE(NEW.design_system_id, OLD.design_system_id);
    boundary bigint := COALESCE(NEW.version_sequence_number, OLD.version_sequence_number);
    validation_key text := owner::text || ':' || boundary::text || ':state_set_coherence';
    checked text[] := COALESCE(string_to_array(NULLIF(current_setting('ds.revision_integrity_checked', true), ''), ','), ARRAY[]::text[]);
    stable_table text;
    entity_column text;
BEGIN
    IF validation_key = ANY(checked) THEN RETURN NULL; END IF;
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
    PERFORM check_resolved_state_set_coherence(owner, boundary);
    PERFORM set_config('ds.revision_integrity_checked', array_to_string(array_append(checked, validation_key), ','), true);
    RETURN NULL;
END;
$$;

CREATE FUNCTION check_palette_revision_integrity(owner uuid, boundary_sequence bigint) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    problem text;
BEGIN
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
END;
$$;

CREATE OR REPLACE FUNCTION enforce_palette_revision_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    owner uuid := COALESCE(NEW.design_system_id, OLD.design_system_id);
    boundary_sequence bigint := COALESCE(NEW.version_sequence_number, OLD.version_sequence_number);
    validation_key text := owner::text || ':' || boundary_sequence::text;
    checked text[] := COALESCE(string_to_array(NULLIF(current_setting('ds.palette_checked_boundaries', true), ''), ','), ARRAY[]::text[]);
BEGIN
    IF validation_key = ANY(checked) THEN RETURN NULL; END IF;
    IF TG_TABLE_NAME = 'token_revisions' AND revision_integrity_keys_unchanged(
        'tokens', TG_RELID::regclass, 'token_id', boundary_sequence,
        to_jsonb(COALESCE(NEW, OLD)), TG_OP, ARRAY['group_id']
    ) THEN RETURN NULL; END IF;
    -- Пакетная операция проверяет итоговый граф один раз, а не по разу на каждую редакцию.
    PERFORM check_palette_revision_integrity(owner, boundary_sequence);
    PERFORM set_config('ds.palette_checked_boundaries', array_to_string(array_append(checked, validation_key), ','), true);
    RETURN NULL;
END;
$$;

-- Открывает окно для системы, вставленной в текущей транзакции и имеющей только базовую границу 0.
-- Проверка xmin верна, пока строка design_systems вставлена на верхнем уровне транзакции: внутри
-- SAVEPOINT или вложенной транзакции у строки xid подтранзакции, и окно не откроется
-- (baseline_seed_requires_new_design_system) — отказ явный, без тихого пропуска проверок.
CREATE FUNCTION begin_design_system_baseline_seed(target uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF COALESCE(current_setting('ds.baseline_seed', true), '') <> '' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'baseline_seed_already_open';
    END IF;
    PERFORM 1 FROM design_systems WHERE id = target AND xmin = pg_current_xact_id()::xid;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'baseline_seed_requires_new_design_system';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM design_system_versions
        WHERE design_system_id = target AND status = 'baseline' AND sequence_number = 0
    ) OR EXISTS (
        SELECT 1 FROM design_system_versions
        WHERE design_system_id = target AND (status IS DISTINCT FROM 'baseline' OR sequence_number <> 0)
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'baseline_seed_requires_only_baseline';
    END IF;
    PERFORM set_config('ds.baseline_seed', target::text, true);
END;
$$;

-- Закрывает окно и один раз проверяет целостность базовой границы по триггерам из каталога.
CREATE FUNCTION verify_design_system_baseline_seed(target uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    trigger_row record;
    arguments text[];
    coherence_checked boolean := false;
    palette_checked boolean := false;
BEGIN
    IF current_setting('ds.baseline_seed', true) IS DISTINCT FROM target::text THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'baseline_seed_not_open';
    END IF;
    PERFORM set_config('ds.baseline_seed', '', true);
    -- Записи окна не сбрасывали памятки проверок; сбрасываем их, чтобы последующие проверки не отсекались.
    PERFORM set_config('ds.revision_integrity_checked', '', true);
    PERFORM set_config('ds.palette_checked_boundaries', '', true);
    FOR trigger_row IN
        SELECT t.tgname, t.tgrelid, t.tgargs, t.tgnargs, p.proname
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE NOT t.tgisinternal
          AND n.nspname = current_schema()
          AND c.relname LIKE '%\_revisions'
          AND c.relname <> 'design_system_revisions'
          AND p.proname LIKE 'enforce\_%'
        ORDER BY c.relname, t.tgname
    LOOP
        IF trigger_row.proname = 'enforce_resolved_revision_unique' THEN
            -- tgargs хранит аргументы через нулевой байт с завершающим нулём; берём ровно tgnargs элементов.
            arguments := (string_to_array(encode(trigger_row.tgargs, 'escape'), '\000'))[1:trigger_row.tgnargs];
            IF array_length(arguments, 1) IS DISTINCT FROM 3 THEN
                RAISE EXCEPTION USING ERRCODE = 'P0001',
                    MESSAGE = 'baseline_seed_unexpected_trigger_arguments: ' || trigger_row.tgname;
            END IF;
            PERFORM check_resolved_revision_unique(arguments[1], trigger_row.tgrelid::regclass, arguments[2],
                arguments[3], target, 0, trigger_row.tgname);
        ELSIF trigger_row.proname = 'enforce_resolved_state_set_coherence' THEN
            IF NOT coherence_checked THEN
                PERFORM check_resolved_state_set_coherence(target, 0);
                coherence_checked := true;
            END IF;
        ELSIF trigger_row.proname = 'enforce_palette_revision_integrity' THEN
            IF NOT palette_checked THEN
                PERFORM check_palette_revision_integrity(target, 0);
                palette_checked := true;
            END IF;
        ELSE
            -- Новая проверка целостности должна быть явно добавлена в итоговую проверку окна.
            RAISE EXCEPTION USING ERRCODE = 'P0001',
                MESSAGE = 'baseline_seed_unknown_integrity_trigger: ' || trigger_row.tgname;
        END IF;
    END LOOP;
END;
$$;

-- Черновик внутри открытого окна означал бы запись в базовую версию в обход защиты черновика.
CREATE OR REPLACE FUNCTION enforce_design_system_version_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    baseline_id uuid;
    deleting_design_system_ids text[] := COALESCE(
        string_to_array(NULLIF(current_setting('ds.deleting_design_system_ids', true), ''), ','),
        ARRAY[]::text[]
    );
BEGIN
    IF TG_OP = 'DELETE' THEN
        -- Прямое удаление границы уничтожило бы историю через каскадные внешние ключи.
        -- Каскад при удалении самой дизайн-системы остаётся разрешённым.
        IF pg_trigger_depth() <= 1
            OR NOT OLD.design_system_id::text = ANY(deleting_design_system_ids) THEN
            RAISE EXCEPTION USING
                ERRCODE = '40001',
                MESSAGE = 'Version boundaries are immutable; delete the design system instead';
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' AND NEW.status = 'published' THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'A published version must be created by publishing a draft';
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status IN ('baseline', 'published') THEN
        RAISE EXCEPTION USING
            ERRCODE = '40001',
            MESSAGE = 'Baseline and published version boundaries are immutable';
    END IF;

    IF TG_OP = 'UPDATE'
        AND OLD.status = 'draft'
        AND (
            NEW.id IS DISTINCT FROM OLD.id
            OR NEW.design_system_id IS DISTINCT FROM OLD.design_system_id
            OR NEW.sequence_number IS DISTINCT FROM OLD.sequence_number
            OR NEW.status NOT IN ('draft', 'published')
        ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '40001',
            MESSAGE = 'A draft may only stay a draft or become published';
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.status IS NULL AND NEW.status IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '40001',
            MESSAGE = 'Archived snapshot boundaries cannot enter the versioned lifecycle';
    END IF;

    IF TG_OP = 'INSERT' AND NEW.status = 'draft' THEN
        IF COALESCE(current_setting('ds.baseline_seed', true), '') <> '' THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'baseline_seed_open_before_draft';
        END IF;

        SELECT id INTO baseline_id
        FROM design_system_versions
        WHERE design_system_id = NEW.design_system_id
          AND status = 'baseline'
        FOR UPDATE;

        IF baseline_id IS NULL THEN
            RAISE EXCEPTION USING
                ERRCODE = '23514',
                MESSAGE = 'A draft requires an initialized baseline';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- Незакрытое окно означает, что итоговая проверка целостности не выполнялась.
CREATE FUNCTION enforce_baseline_seed_closed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF COALESCE(current_setting('ds.baseline_seed', true), '') <> '' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'baseline_seed_not_verified';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER design_systems_baseline_seed_closed AFTER INSERT ON design_systems
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_baseline_seed_closed();

-- Условие WHEN не ссылается на NEW/OLD, поэтому подходит и для INSERT OR DELETE/UPDATE:
-- триггеры не делятся и не переименовываются, порядок срабатывания по имени сохраняется.
-- У отложенных триггеров WHEN вычисляется в момент события, и событие не ставится в очередь.
DO $$
DECLARE
    trigger_row record;
    definition text;
    seed_condition constant text := 'WHEN (COALESCE(current_setting(''ds.baseline_seed'', true), '''') = '''')';
BEGIN
    FOR trigger_row IN
        SELECT t.oid, t.tgname, c.relname, t.tgconstraint <> 0 AS is_constraint, t.tgqual IS NOT NULL AS has_condition
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE NOT t.tgisinternal
          AND n.nspname = current_schema()
          AND c.relname LIKE '%\_revisions'
          AND c.relname <> 'design_system_revisions'
        ORDER BY c.relname, t.tgname
    LOOP
        IF trigger_row.has_condition THEN
            RAISE EXCEPTION 'Trigger % on % already has a WHEN condition', trigger_row.tgname, trigger_row.relname;
        END IF;
        definition := pg_get_triggerdef(trigger_row.oid);
        IF position(' FOR EACH ROW EXECUTE FUNCTION ' IN definition) = 0 THEN
            RAISE EXCEPTION 'Unexpected definition of trigger %: %', trigger_row.tgname, definition;
        END IF;
        definition := replace(definition, ' FOR EACH ROW EXECUTE FUNCTION ',
            ' FOR EACH ROW ' || seed_condition || ' EXECUTE FUNCTION ');
        IF trigger_row.is_constraint THEN
            EXECUTE format('DROP TRIGGER %I ON %I', trigger_row.tgname, trigger_row.relname);
            EXECUTE definition;
        ELSE
            EXECUTE regexp_replace(definition, '^CREATE TRIGGER ', 'CREATE OR REPLACE TRIGGER ');
        END IF;
    END LOOP;
END;
$$;

-- Сторож окна: пока окно открыто, в *_revisions допускается только вставка редакций целевой системы
-- на границе 0. Вставка в другую систему или границу, а также удаление и изменение редакций отклоняются.
-- Для правильных строк раскладки условие WHEN ложно и функция не вызывается. Сторожа создаются после
-- DO-блока выше, поэтому не получают общее условие окна, и не начинаются на enforce_, поэтому не входят
-- в итоговую проверку verify_design_system_baseline_seed. Самое длинное имя таблицы — 45 символов,
-- с суффиксом имя триггера укладывается в 63. Будущая миграция, повторяющая DO-блок выше, должна
-- исключать сторожей (суффикс _seed_guard_), а новая таблица *_revisions — получать и условие окна, и сторожей.
CREATE FUNCTION reject_baseline_seed_foreign_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'baseline_seed_foreign_write',
        DETAIL = TG_OP || ' ' || TG_TABLE_NAME;
END;
$$;

DO $$
DECLARE
    table_row record;
BEGIN
    FOR table_row IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r'
          AND n.nspname = current_schema()
          AND c.relname LIKE '%\_revisions'
          AND c.relname <> 'design_system_revisions'
        ORDER BY c.relname
    LOOP
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW '
            || 'WHEN (COALESCE(current_setting(''ds.baseline_seed'', true), '''') <> '''' AND ('
            || 'NEW.design_system_id::text IS DISTINCT FROM current_setting(''ds.baseline_seed'', true) '
            || 'OR NEW.version_sequence_number <> 0)) '
            || 'EXECUTE FUNCTION reject_baseline_seed_foreign_write()',
            table_row.relname || '_seed_guard_insert', table_row.relname
        );
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW '
            || 'WHEN (COALESCE(current_setting(''ds.baseline_seed'', true), '''') <> '''') '
            || 'EXECUTE FUNCTION reject_baseline_seed_foreign_write()',
            table_row.relname || '_seed_guard_change', table_row.relname
        );
    END LOOP;
END;
$$;
