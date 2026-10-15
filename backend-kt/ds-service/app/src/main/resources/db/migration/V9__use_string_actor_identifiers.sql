-- Идентификаторы пользователей и проектных ключей приходят из authorization-core как строки.
ALTER TABLE entity_edit_states
    ALTER COLUMN last_actor_id TYPE text USING last_actor_id::text;

ALTER TABLE entity_edit_paths
    ALTER COLUMN last_actor_id TYPE text USING last_actor_id::text;

ALTER TABLE idempotent_requests
    ALTER COLUMN actor_id TYPE text USING actor_id::text;
