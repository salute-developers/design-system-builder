-- JSONB normalizes property order and whitespace. The idempotency contract
-- replays the exact response produced by the first request, so the body is
-- stored as opaque JSON text after validation by the presentation layer.
ALTER TABLE idempotent_requests
    ALTER COLUMN response_body TYPE text
    USING response_body::text;
