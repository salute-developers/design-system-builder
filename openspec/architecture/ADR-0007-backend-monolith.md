# ADR-0007: Backend monolith deployment boundary

## Status

Accepted for parallel rollout.

## Decision

Identity, Projects, and Documentation Kotlin capabilities are composed in `backend-kt/monolith/app` as one Ktor engine. Capability modules expose application contracts, route registration, and lifecycle handles; the monolith owns global plugins, health, startup, and shutdown.

Identity calls Projects through `ProjectAuthorizationService` in-process. Documentation continues to call `js/services/db-service`, the source of truth for component configuration, over loopback HTTP. nginx remains the public trust boundary and is the only published port.

The monolith keeps a separate nginx template because parallel rollout requires different upstream topology. Its public Keycloak, CORS, forwarding, trusted-header, rate-limit, redirect, and Documentation proxy contracts remain aligned with the legacy gateway and are checked against the fully rendered configuration. Only upstream topology and explicitly excluded routes may differ.

Keycloak administration and application administration are deliberately excluded from the monolith public surface: `/admin`, `/admin/**`, `/api/admin`, and `/api/admin/**` return `404` and are never proxied to Keycloak or `db-service`. This is a security exception to public-path compatibility; administration remains on separately controlled operational surfaces during the parallel rollout.

The `backend-monolith` image contains nginx, the Kotlin runtime, and `db-service`. Keycloak, three capability-owned PostgreSQL databases, and S3 storage remain external. Legacy service images and deployment contours remain supported during migration.

`backend-kt/project-publisher` and JS `generator`, `publisher`, and `documentation-generator` are deprecated. They are excluded from the monolith image and both monolith Compose contours. Reintroducing them requires a separate architecture change.

## Consequences

The new deployment has one atomic fail-fast lifecycle but preserves capability persistence ownership and public HTTP contracts, except for the intentionally excluded administrative paths above. Rollback only redirects traffic to the legacy contour; it does not require reverse schema or API migrations.
