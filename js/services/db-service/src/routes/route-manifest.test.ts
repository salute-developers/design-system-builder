import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { spec } from "../openapi/spec";

type Operation = [string, string, string | null, string, number, string, string | null];

type RouteGroup = {
  name: string;
  router: string;
  operations: Operation[];
};

type RouteManifest = {
  internalPrefix: string;
  legacyOpenApiPrefix: string;
  groups: RouteGroup[];
};

type ExcludedRouteGroup = {
  name: string;
  sources: string[];
};

type ExcludedRouteGroups = {
  groups: ExcludedRouteGroup[];
};

const testDirectory = dirname(fileURLToPath(import.meta.url));
const serviceDirectory = resolve(testDirectory, "../..");
const contractDirectory = resolve(testDirectory, "../../../../../backend-kt/ds-service/contracts");

const manifest = JSON.parse(
  readFileSync(resolve(contractDirectory, "route-manifest.json"), "utf8"),
) as RouteManifest;
const exclusions = JSON.parse(
  readFileSync(resolve(contractDirectory, "excluded-route-groups.json"), "utf8"),
) as ExcludedRouteGroups;

const normalizePath = (path: string) =>
  path
    .replace(/:([A-Za-z][A-Za-z0-9_]*)/g, "{$1}")
    .replace(/\/$/, "") || "/";

const operationKey = (method: string, path: string) => `${method.toUpperCase()} ${normalizePath(path)}`;

const mountedSources = () => {
  const indexSource = readFileSync(resolve(serviceDirectory, "src/routes/index.ts"), "utf8");
  const imports = new Map<string, string>();
  const mounts = new Map<string, string>();

  for (const match of indexSource.matchAll(/import\s+(\w+)\s+from\s+["']\.\/(api|misc)\/([^"']+)["'];/g)) {
    imports.set(match[1], `src/routes/${match[2]}/${match[3]}.ts`);
  }
  for (const match of indexSource.matchAll(/router\.use\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/g)) {
    const source = imports.get(match[2]);
    if (source) mounts.set(source, match[1]);
  }
  return mounts;
};

const registeredOperations = (sources: string[]) => {
  const mounts = mountedSources();
  const operations = new Set<string>();

  for (const source of sources) {
    const mount = mounts.get(source);
    expect(mount, `${source} must be mounted by src/routes/index.ts`).toBeDefined();
    const routeSource = readFileSync(resolve(serviceDirectory, source), "utf8");
    for (const match of routeSource.matchAll(/router\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g)) {
      operations.add(operationKey(match[1], `${mount}${match[2] === "/" ? "" : match[2]}`));
    }
  }
  return operations;
};

describe("ds-service route manifest", () => {
  it("matches the included Express route registration exactly", () => {
    const expected = new Set(
      manifest.groups.flatMap((group) =>
        group.operations.map(([method, suffix]) => operationKey(method, `/ds${suffix}`)),
      ),
    );
    const actual = registeredOperations(manifest.groups.flatMap((group) => group.router.split(",")));

    expect([...actual].sort()).toEqual([...expected].sort());
  });

  it("keeps excluded source groups outside the API contract", () => {
    const includedSources = new Set(manifest.groups.flatMap((group) => group.router.split(",")));
    const excludedSources = exclusions.groups.flatMap((group) => group.sources);

    expect(excludedSources.every((source) => !includedSources.has(source))).toBe(true);
    expect(registeredOperations(excludedSources).size).toBeGreaterThan(0);
  });

  it("matches the existing OpenAPI methods and success statuses", () => {
    for (const group of manifest.groups) {
      for (const [method, suffix, , , successStatus] of group.operations) {
        const path = `${manifest.legacyOpenApiPrefix}${suffix}`;
        const operation = spec.paths?.[path]?.[method.toLowerCase() as "get"];
        expect(operation, `${method} ${path} must exist in db-service OpenAPI`).toBeDefined();
        expect(
          operation?.responses?.[successStatus],
          `${method} ${path} must document ${successStatus}`,
        ).toBeDefined();
      }
    }
  });
});
