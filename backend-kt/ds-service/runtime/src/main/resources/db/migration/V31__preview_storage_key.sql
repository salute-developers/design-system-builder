-- NULL сохраняет прежний путь build_id для существующих записей.
ALTER TABLE compose_preview_plugin_builds ADD COLUMN storage_key text;
CREATE UNIQUE INDEX preview_storage_key_unique ON compose_preview_plugin_builds(storage_key)
    WHERE storage_key IS NOT NULL;
