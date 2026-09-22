# Backend monolith deployment

The backend monolith is an additional deployment contour. It does not replace the legacy Identity, Projects, Documentation, gateway, or db-service images yet.

## Topology

One container runs three required processes under fail-fast supervision:

- nginx is the only public entry point on port `8080`;
- the Kotlin Ktor application listens on loopback port `8081`;
- Node.js `db-service` listens on loopback port `3008`.

Keycloak, the three PostgreSQL databases (db-service, Projects, and Documentation), and S3-compatible storage remain external. The local Compose file supplies them. Production Compose requires external endpoints and only pulls the registry image.

`project-publisher`, JS `generator`, `publisher`, and `documentation-generator` are deprecated deployment components and are intentionally absent from this runtime.

## Configuration

Copy `.env.monolith.example` to `.env.monolith` for local development. The example contains local-only placeholders, not production secrets. Important groups are:

- `MONOLITH_*`, `JAVA_OPTS`, and `NODE_OPTIONS` for ports, startup timing, and memory;
- `DATABASE_URL`/`DB_SERVICE_POSTGRES_*`, `PROJECTS_*`, and `DOCUMENTATION_*` for isolated persistence;
- `KEYCLOAK_*`, `OIDC_*`, and `PROJECTS_IDENTITY_KEYCLOAK_*` for identity;
- `DOCUMENTATION_S3_*`/`MINIO_*` for storage;
- `REGISTRY_HOST`, `REGISTRY_NAMESPACE`, and `IMAGE_TAG` for production delivery.

Only `8080` may be published. Ports `8081` and `3008` must never appear in Compose `ports`; both are loopback-only trusted boundaries inside the container.

## Startup and migrations

Run `./start-monolith.sh --detach` to build, start, and wait for readiness. `--no-build` reuses the configured image, `--logs` follows backend logs, and `--down` stops only the isolated `dsbuilder-monolith` Compose project.

The one-shot `db-service-migrate` service runs Drizzle migrations before the backend. It never runs a production seed. Projects initializes its current schema at Kotlin startup; Documentation runs its owned Flyway migrations before its worker starts.

## Health and supervision

`/health/live` proves the Kotlin process is alive. `/health/ready` aggregates Projects database, Documentation database/storage, and Documentation worker readiness. The image healthcheck also verifies nginx and Node `/api/health`.

nginx, Kotlin, and Node are mandatory. If any exits unexpectedly—even with status 0—the supervisor terminates the others and exits nonzero. On SIGTERM it forwards termination, waits up to `MONOLITH_SHUTDOWN_TIMEOUT_SECONDS`, and then force-kills remaining processes. All process logs go to stdout/stderr.

## Rollout and rollback

Publish the `backend-monolith` image with `dev`, `release`, or a versioned `release_*` tag. Deploy `docker-compose.monolith.prod.yml` beside the legacy contour, validate public REST paths and trusted headers, then switch traffic to monolith port `8080`.

Rollback switches traffic back to the legacy contour. No public API or persistence schema is monolith-specific, so rollback requires no reverse data migration. Keep the legacy images and Compose definitions until a separate removal change is approved.

## Resource acceptance

The local contour limits the combined container to `2 GiB`, `2 CPU`, and 512 PIDs with JVM `-Xmx768m` and Node `384 MiB`. Production defaults to `3 GiB`, `2 CPU`, and 512 PIDs with JVM `-Xmx1536m` and Node `512 MiB`. All limits remain configurable through `MONOLITH_MEMORY_LIMIT`, `MONOLITH_CPU_LIMIT`, `MONOLITH_PIDS_LIMIT`, `JAVA_OPTS`, and `NODE_OPTIONS`.

The 2026-09-19 local acceptance run used the complete upload/publication/search smoke flow followed by 100 authenticated Project list requests below the configured nginx rate limit. All 100 requests succeeded at 6.16 requests/second; combined container memory was 384.8 MiB after the run. G1 reclaimed the largest observed young generation from 158 MiB to 23 MiB, and the maximum observed stop-the-world pause was 26.184 ms. A separate burst of 500 requests at concurrency 20 was contained by the configured rate limiter without a process restart.

During the same run MinIO was stopped temporarily. Aggregate readiness changed to HTTP 503 while the container and all supervised processes remained running, then recovered to HTTP 200 after MinIO returned. This confirms that a temporary external-integration outage does not create a restart loop; the deployment orchestrator should route traffic using readiness while reserving restarts for process exits.
