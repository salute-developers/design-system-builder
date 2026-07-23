#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_INPUT =
  "/Users/alex/StudioProjects/plasma-android/sdds-core/uikit-compose/build/generated/ksp/release/resources/sdds/api/uikit-api-meta.json";
const DEFAULT_API_BASE = "http://localhost:3008/api/ds";
const SUPPORTED_PROPERTY_TYPES = new Set([
  "color",
  "typography",
  "shape",
  "shadow",
  "dimension",
  "float",
]);
const SUPPORTED_PLATFORMS = new Set(["xml", "compose", "ios", "web"]);

const usage = () => {
  console.log(`Usage:
  node scripts/import-uikit-api-meta.mjs [options]

Options:
  --input <path>             Path to uikit-api-meta.json
                             Default: ${DEFAULT_INPUT}
  --api-base <url>           DB Service DS API base URL
                             Default: ${DEFAULT_API_BASE}
  --platform <name>          Platform for property alias: xml|compose|ios|web
                             Default: compose
  --include-types <list>     Comma-separated params.type allow-list
                             Default: supported DB types only
  --map-type <from:to>       Map unsupported JSON type to DB property type.
                             Can be repeated, e.g. --map-type integer:dimension
  --link-design-systems      Link imported components to all design systems
  --apply                    Write changes. Without this flag the script is dry-run.
  --strict                   Fail if JSON contains unsupported params.type
  --help                     Show this help

Examples:
  node scripts/import-uikit-api-meta.mjs
  node scripts/import-uikit-api-meta.mjs --apply
  node scripts/import-uikit-api-meta.mjs --apply --link-design-systems
  node scripts/import-uikit-api-meta.mjs --apply --map-type integer:dimension
`);
};

const parseArgs = (argv) => {
  const args = {
    input: DEFAULT_INPUT,
    apiBase: DEFAULT_API_BASE,
    platform: "compose",
    apply: false,
    strict: false,
    linkDesignSystems: false,
    includeTypes: null,
    typeMap: new Map(),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${arg}`);
      }
      i += 1;
      return value;
    };

    if (arg === "--help") {
      usage();
      process.exit(0);
    } else if (arg === "--input") {
      args.input = next();
    } else if (arg === "--api-base") {
      args.apiBase = next().replace(/\/$/, "");
    } else if (arg === "--platform") {
      args.platform = next();
    } else if (arg === "--include-types") {
      args.includeTypes = new Set(
        next()
          .split(",")
          .map((type) => type.trim())
          .filter(Boolean),
      );
    } else if (arg === "--map-type") {
      const [from, to] = next().split(":");
      if (!from || !to) {
        throw new Error("--map-type expects value in from:to format");
      }
      args.typeMap.set(from, to);
    } else if (arg === "--apply") {
      args.apply = true;
    } else if (arg === "--link-design-systems") {
      args.linkDesignSystems = true;
    } else if (arg === "--strict") {
      args.strict = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!SUPPORTED_PLATFORMS.has(args.platform)) {
    throw new Error(`Unsupported platform: ${args.platform}`);
  }

  for (const [from, to] of args.typeMap) {
    if (!SUPPORTED_PROPERTY_TYPES.has(to)) {
      throw new Error(`Cannot map ${from} to unsupported DB property type: ${to}`);
    }
  }

  return args;
};

const apiRequest = async (apiBase, method, route, body) => {
  const response = await fetch(`${apiBase}${route}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${method} ${route} failed: ${response.status} ${text}`);
  }

  return response.json();
};

const loadMeta = async (input) => {
  const raw = await fs.readFile(path.resolve(input), "utf8");
  const data = JSON.parse(raw);

  if (!Array.isArray(data)) {
    throw new Error("Expected root JSON value to be an array");
  }

  return data;
};

const resolveType = (type, args) => args.typeMap.get(type) ?? type;

const isIncludedType = (originalType, resolvedType, args) => {
  if (args.includeTypes) {
    return args.includeTypes.has(originalType) || args.includeTypes.has(resolvedType);
  }

  return SUPPORTED_PROPERTY_TYPES.has(resolvedType);
};

const buildManifest = (meta, args) => {
  const components = new Map();
  const skippedTypes = new Map();
  const duplicates = [];

  for (const entry of meta) {
    if (!entry?.componentName) {
      continue;
    }

    if (!components.has(entry.componentName)) {
      components.set(entry.componentName, new Map());
    }

    const propertiesByName = components.get(entry.componentName);

    for (const param of entry.params ?? []) {
      if (!param?.id || !param?.type) {
        continue;
      }

      const resolvedType = resolveType(param.type, args);

      if (!isIncludedType(param.type, resolvedType, args)) {
        skippedTypes.set(param.type, (skippedTypes.get(param.type) ?? 0) + 1);
        continue;
      }

      if (!SUPPORTED_PROPERTY_TYPES.has(resolvedType)) {
        skippedTypes.set(param.type, (skippedTypes.get(param.type) ?? 0) + 1);
        continue;
      }

      const existing = propertiesByName.get(param.id);

      if (existing) {
        duplicates.push({
          componentName: entry.componentName,
          propertyName: param.id,
          type: resolvedType,
        });
        continue;
      }

      propertiesByName.set(param.id, {
        name: param.id,
        type: resolvedType,
        sourceType: param.type,
        description: [
          param.group ? `group: ${param.group}` : null,
          param.methodName ? `method: ${param.methodName}` : null,
          param.paramSimpleType ? `param: ${param.paramSimpleType}` : null,
        ]
          .filter(Boolean)
          .join("; "),
      });
    }
  }

  if (args.strict && skippedTypes.size > 0) {
    const summary = [...skippedTypes.entries()]
      .map(([type, count]) => `${type}=${count}`)
      .join(", ");
    throw new Error(`Unsupported params.type found: ${summary}`);
  }

  return { components, skippedTypes, duplicates };
};

const indexBy = (rows, key) => new Map(rows.map((row) => [key(row), row]));

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const meta = await loadMeta(args.input);
  const { components, skippedTypes, duplicates } = buildManifest(meta, args);

  const summary = {
    sourceComponents: meta.length,
    importComponents: components.size,
    importProperties: [...components.values()].reduce(
      (sum, properties) => sum + properties.size,
      0,
    ),
    duplicateParamsCollapsed: duplicates.length,
    skippedParams: [...skippedTypes.values()].reduce((sum, count) => sum + count, 0),
  };

  console.log(JSON.stringify({ mode: args.apply ? "apply" : "dry-run", ...summary }, null, 2));

  if (skippedTypes.size > 0) {
    console.log(
      `Skipped params by type: ${[...skippedTypes.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([type, count]) => `${type}=${count}`)
        .join(", ")}`,
    );
  }

  if (!args.apply) {
    console.log("Dry-run only. Re-run with --apply to write to DB Service.");
    return;
  }

  const existingComponents = indexBy(
    await apiRequest(args.apiBase, "GET", "/components"),
    (component) => component.name,
  );
  const allPlatformParams = await apiRequest(
    args.apiBase,
    "GET",
    "/property-platform-params",
  );
  const designSystems = args.linkDesignSystems
    ? await apiRequest(args.apiBase, "GET", "/design-systems")
    : [];
  const designSystemComponents = args.linkDesignSystems
    ? await apiRequest(args.apiBase, "GET", "/design-system-components")
    : [];

  let createdComponents = 0;
  let createdProperties = 0;
  let updatedProperties = 0;
  let createdAliases = 0;
  let existingAliases = 0;
  let createdDesignSystemLinks = 0;
  let existingDesignSystemLinks = 0;

  for (const [componentName, manifestProperties] of components) {
    let component = existingComponents.get(componentName);

    if (!component) {
      component = await apiRequest(args.apiBase, "POST", "/components", {
        name: componentName,
        description: "Imported from uikit-api-meta.json",
      });
      existingComponents.set(componentName, component);
      createdComponents += 1;
    }

    if (args.linkDesignSystems) {
      for (const designSystem of designSystems) {
        const hasLink = designSystemComponents.some(
          (link) =>
            link.designSystemId === designSystem.id && link.componentId === component.id,
        );

        if (hasLink) {
          existingDesignSystemLinks += 1;
          continue;
        }

        const link = await apiRequest(args.apiBase, "POST", "/design-system-components", {
          designSystemId: designSystem.id,
          componentId: component.id,
        });
        designSystemComponents.push(link);
        createdDesignSystemLinks += 1;
      }
    }

    const existingProperties = indexBy(
      await apiRequest(args.apiBase, "GET", `/components/${component.id}/properties`),
      (property) => property.name,
    );

    for (const property of manifestProperties.values()) {
      let dbProperty = existingProperties.get(property.name);

      if (!dbProperty) {
        dbProperty = await apiRequest(args.apiBase, "POST", "/properties", {
          componentId: component.id,
          name: property.name,
          type: property.type,
          description: property.description || undefined,
        });
        existingProperties.set(property.name, dbProperty);
        createdProperties += 1;
      } else if (dbProperty.type !== property.type) {
        dbProperty = await apiRequest(args.apiBase, "PATCH", `/properties/${dbProperty.id}`, {
          type: property.type,
          description: property.description || dbProperty.description || undefined,
        });
        existingProperties.set(property.name, dbProperty);
        updatedProperties += 1;
      }

      const hasAlias = allPlatformParams.some(
        (alias) =>
          alias.propertyId === dbProperty.id &&
          alias.platform === args.platform &&
          alias.name === property.name,
      );

      if (hasAlias) {
        existingAliases += 1;
        continue;
      }

      const alias = await apiRequest(args.apiBase, "POST", "/property-platform-params", {
        propertyId: dbProperty.id,
        platform: args.platform,
        name: property.name,
      });
      allPlatformParams.push(alias);
      createdAliases += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        createdComponents,
        createdProperties,
        updatedProperties,
        createdAliases,
        existingAliases,
        createdDesignSystemLinks,
        existingDesignSystemLinks,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
