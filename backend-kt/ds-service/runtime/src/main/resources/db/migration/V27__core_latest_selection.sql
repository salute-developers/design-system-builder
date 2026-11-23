-- Старые настройки остаются закреплёнными; latest включается только явно.
ALTER TABLE design_system_version_core_releases
    ADD COLUMN selection_mode text NOT NULL DEFAULT 'pinned'
    CHECK (selection_mode IN ('pinned', 'latest'));
CREATE INDEX core_release_channel_recency ON core_releases(platform, channel, created_at DESC, id);
