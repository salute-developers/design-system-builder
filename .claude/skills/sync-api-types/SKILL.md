---
name: sync-api-types
description: Regenerate admin TypeScript API types from the OpenAPI spec. Use after changes to js/services/db-service/src/openapi/spec.ts, js/services/db-service/src/routes/api/, or after running sync-spec.
---

Regenerate the admin API types by running two commands sequentially:

```bash
cd js/services/db-service && npm run openapi:gen
```

```bash
cd js/apps/admin && npm run api:gen
```

Step 1 runs `tsx src/openapi/generate.ts` inside `js/services/db-service`, which writes `js/apps/admin/src/api/openapi.json` from `js/services/db-service/src/openapi/spec.ts`.

Step 2 runs `openapi-typescript` inside `js/apps/admin`, which generates `js/apps/admin/src/api/types.gen.ts` from the JSON file.

Both files are build artifacts. After the commands complete, report whether they succeeded and which files were updated.
