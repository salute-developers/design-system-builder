-- Доступность не входит в редакции и не изменяется публикацией или откатом.
ALTER TABLE design_systems
    ADD COLUMN visibility text NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'public'));
