-- Устойчивый каталог сохраняется. Релиз хранит самостоятельное описание API.
CREATE TABLE core_releases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id text NOT NULL CHECK (btrim(library_id) <> ''),
    platform component_platform NOT NULL,
    version text NOT NULL CHECK (btrim(version) <> ''),
    source_meta bytea,
    meta_sha256 text CHECK (meta_sha256 ~ '^[0-9a-f]{64}$'),
    normalized_meta jsonb NOT NULL,
    provenance text NOT NULL CHECK (provenance IN ('imported', 'migration-snapshot')),
    created_at timestamp NOT NULL DEFAULT now(),
    UNIQUE (library_id, platform, version),
    UNIQUE (id, platform),
    CHECK (provenance = 'migration-snapshot' OR (source_meta IS NOT NULL AND meta_sha256 IS NOT NULL))
);

CREATE TABLE core_current_releases (
    platform component_platform PRIMARY KEY,
    release_id uuid NOT NULL,
    FOREIGN KEY (release_id, platform) REFERENCES core_releases(id, platform)
);

CREATE TABLE core_release_components (
    release_id uuid NOT NULL REFERENCES core_releases(id),
    component_id uuid NOT NULL REFERENCES components(id),
    name text NOT NULL,
    description text,
    PRIMARY KEY (release_id, component_id),
    UNIQUE (release_id, name)
);
CREATE TABLE core_release_properties (
    release_id uuid NOT NULL,
    property_id uuid NOT NULL REFERENCES properties(id),
    component_id uuid NOT NULL,
    name text NOT NULL,
    type property_type NOT NULL,
    default_value text,
    description text,
    component_targets jsonb NOT NULL DEFAULT '[]',
    PRIMARY KEY (release_id, property_id),
    FOREIGN KEY (release_id, component_id) REFERENCES core_release_components(release_id, component_id),
    UNIQUE (release_id, component_id, name)
);
CREATE TABLE core_release_states (
    release_id uuid NOT NULL,
    state_id uuid NOT NULL REFERENCES states(id),
    component_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    PRIMARY KEY (release_id, state_id),
    FOREIGN KEY (release_id, component_id) REFERENCES core_release_components(release_id, component_id)
);
CREATE TABLE core_release_platform_params (
    release_id uuid NOT NULL,
    platform_param_id uuid NOT NULL REFERENCES property_platform_params(id),
    property_id uuid NOT NULL,
    name text NOT NULL,
    deprecated boolean NOT NULL,
    deprecated_message text,
    PRIMARY KEY (release_id, platform_param_id),
    FOREIGN KEY (release_id, property_id) REFERENCES core_release_properties(release_id, property_id)
);
CREATE TABLE core_release_component_dependencies (
    release_id uuid NOT NULL,
    dependency_id uuid NOT NULL REFERENCES component_deps(id),
    parent_id uuid NOT NULL,
    child_id uuid NOT NULL,
    type relation_type NOT NULL CHECK (type = 'compose'),
    "order" integer,
    PRIMARY KEY (release_id, parent_id, child_id, type),
    FOREIGN KEY (release_id, parent_id) REFERENCES core_release_components(release_id, component_id),
    FOREIGN KEY (release_id, child_id) REFERENCES core_release_components(release_id, component_id)
);
CREATE TABLE design_system_version_core_releases (
    version_id uuid NOT NULL REFERENCES design_system_versions(id) ON DELETE CASCADE,
    platform component_platform NOT NULL,
    release_id uuid NOT NULL,
    PRIMARY KEY (version_id, platform),
    UNIQUE (version_id, platform, release_id),
    FOREIGN KEY (release_id, platform) REFERENCES core_releases(id, platform)
);
CREATE TABLE core_release_preview_builds (
    build_id text PRIMARY KEY REFERENCES compose_preview_plugin_builds(build_id) ON DELETE CASCADE,
    release_id uuid NOT NULL REFERENCES core_releases(id),
    registered_at timestamp NOT NULL DEFAULT now(),
    UNIQUE (build_id, release_id)
);
CREATE TABLE design_system_version_preview_builds (
    version_id uuid NOT NULL,
    platform component_platform NOT NULL,
    release_id uuid NOT NULL,
    build_id text,
    PRIMARY KEY (version_id, platform),
    FOREIGN KEY (version_id, platform, release_id)
        REFERENCES design_system_version_core_releases(version_id, platform, release_id) ON DELETE CASCADE,
    FOREIGN KEY (build_id, release_id) REFERENCES core_release_preview_builds(build_id, release_id)
);
CREATE INDEX core_release_preview_recency ON core_release_preview_builds(release_id, registered_at DESC, build_id);

-- Происхождение старого каталога недоказуемо: снимок не выдаётся за реальную версию библиотеки.
INSERT INTO core_releases(library_id, platform, version, normalized_meta, provenance)
SELECT 'migration:' || platform::text, platform, 'catalog-at-migration', '[]', 'migration-snapshot'
FROM unnest(enum_range(NULL::component_platform)) AS platform;
INSERT INTO core_current_releases SELECT platform, id FROM core_releases;
INSERT INTO core_release_components
SELECT r.id, c.id, c.name, c.description FROM core_releases r JOIN components c ON c.platform = r.platform;
INSERT INTO core_release_properties
SELECT r.id, p.id, p.component_id, p.name, p.type, p.default_value, p.description, '[]'
FROM core_releases r JOIN components c ON c.platform = r.platform JOIN properties p ON p.component_id = c.id;
INSERT INTO core_release_states
SELECT r.id, s.id, s.component_id, s.name, s.description
FROM core_releases r JOIN components c ON c.platform = r.platform JOIN states s ON s.component_id = c.id;
INSERT INTO core_release_platform_params
SELECT r.id, pp.id, pp.property_id, pp.name, pp.deprecated, pp.deprecated_message
FROM core_releases r JOIN core_release_properties p ON p.release_id = r.id
JOIN property_platform_params pp ON pp.property_id = p.property_id AND pp.platform = r.platform;
-- Только COMPOSE; REUSE принадлежит выбранным предметным редакциям ДС.
INSERT INTO core_release_component_dependencies
SELECT r.id, d.id, d.parent_id, d.child_id, d.type, d."order"
FROM core_releases r JOIN core_release_components p ON p.release_id = r.id
JOIN component_deps d ON d.parent_id = p.component_id AND d.type = 'compose'
JOIN core_release_components c ON c.release_id = r.id AND c.component_id = d.child_id;
UPDATE core_releases r SET normalized_meta = jsonb_build_object(
    'provenance', 'migration-snapshot', 'historicalOrigin', 'unknown',
    'components', COALESCE((SELECT jsonb_agg(to_jsonb(c) - 'release_id' ORDER BY c.name)
        FROM core_release_components c WHERE c.release_id = r.id), '[]'),
    'properties', COALESCE((SELECT jsonb_agg(to_jsonb(p) - 'release_id' ORDER BY p.property_id)
        FROM core_release_properties p WHERE p.release_id = r.id), '[]'),
    'states', COALESCE((SELECT jsonb_agg(to_jsonb(s) - 'release_id' ORDER BY s.state_id)
        FROM core_release_states s WHERE s.release_id = r.id), '[]'),
    'platformParams', COALESCE((SELECT jsonb_agg(to_jsonb(p) - 'release_id' ORDER BY p.platform_param_id)
        FROM core_release_platform_params p WHERE p.release_id = r.id), '[]'),
    'dependencies', COALESCE((SELECT jsonb_agg(to_jsonb(d) - 'release_id' ORDER BY d.dependency_id)
        FROM core_release_component_dependencies d WHERE d.release_id = r.id), '[]')
) WHERE provenance = 'migration-snapshot';

INSERT INTO design_system_version_core_releases
SELECT v.id, r.platform, r.id FROM design_system_versions v CROSS JOIN core_releases r WHERE v.status <> 'draft';
INSERT INTO design_system_version_preview_builds(version_id, platform, release_id)
SELECT version_id, platform, release_id FROM design_system_version_core_releases;

CREATE FUNCTION core_release_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'CORE_RELEASE_IMMUTABLE';
END;
$$;
DO $$
DECLARE table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['core_releases', 'core_release_components', 'core_release_properties',
        'core_release_states', 'core_release_platform_params', 'core_release_component_dependencies'] LOOP
        EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION core_release_immutable()',
            table_name || '_immutable', table_name);
    END LOOP;
END;
$$;

CREATE FUNCTION protect_core_import_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_TABLE_NAME = 'components' THEN
        IF (NEW.name, NEW.platform) IS DISTINCT FROM (OLD.name, OLD.platform)
           AND EXISTS(SELECT 1 FROM core_release_components WHERE component_id = OLD.id) THEN
            RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'CORE_IDENTITY_IMMUTABLE';
        END IF;
    ELSIF (NEW.name, NEW.component_id) IS DISTINCT FROM (OLD.name, OLD.component_id)
          AND EXISTS(SELECT 1 FROM core_release_properties WHERE property_id = OLD.id) THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'CORE_IDENTITY_IMMUTABLE';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER components_core_identity BEFORE UPDATE ON components
    FOR EACH ROW EXECUTE FUNCTION protect_core_import_identity();
CREATE TRIGGER properties_core_identity BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION protect_core_import_identity();
