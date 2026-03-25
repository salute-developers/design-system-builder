import { writeFileSync } from "fs";
import { resolve } from "path";
import { spec } from "./spec";

const outPath = resolve(__dirname, "../../../admin/src/api/openapi.json");

writeFileSync(outPath, JSON.stringify(spec, null, 2));
console.log(`OpenAPI spec written to ${outPath}`);
