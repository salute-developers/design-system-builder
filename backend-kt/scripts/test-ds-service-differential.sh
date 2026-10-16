#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

npm --prefix "$ROOT/js/services/db-service" run test:contracts
npm --prefix "$ROOT/js/services/db-service" run build

"$ROOT/backend-kt/ds-service/gradlew" -p "$ROOT/backend-kt/ds-service" :app:shadowJar
DS_SERVICE_JAR="$(find "$ROOT/backend-kt/ds-service/app/build/libs" -name '*-all.jar' -print -quit)" \
  node --import "$ROOT/js/services/db-service/node_modules/tsx/dist/loader.mjs" \
  "$ROOT/js/services/db-service/src/test/differential-runner.ts"

"$ROOT/backend-kt/ds-service/gradlew" \
  -p "$ROOT/backend-kt/ds-service" \
  :app:test \
  --tests com.dsbuilder.ds.app.OpenApiDocumentResourceTest \
  --tests com.dsbuilder.ds.app.DsServiceHttpPostgresIntegrationTest \
  --tests com.dsbuilder.ds.app.FlywayPostgresIntegrationTest
