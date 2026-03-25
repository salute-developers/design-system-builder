import { Router } from "express";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../../db/index";
import {
  designSystems,
  designSystemComponents,
  designSystemVersions,
  tokens,
  tokenValues,
  palette,
  appearances,
  variations,
  properties,
  propertyPlatformParams,
  propertyVariations,
  styles,
  invariantPropertyValues,
  variationPropertyValues,
  tenants,
  components,
  variationPlatformParamAdjustments,
  invariantPlatformParamAdjustments,
} from "../../db/schema";
import { optionalAuthenticate } from "../../validation/middleware";
import { assertDsAccess, assertFound, tryCatch } from "./utils";

const router = Router();

// GET /legacy/design-systems/:name/component-configs
router.get("/:name/component-configs", optionalAuthenticate, (req, res) =>
  tryCatch(res, async () => {
    const [ds] = await db
      .select()
      .from(designSystems)
      .where(eq(designSystems.name, req.params.name));

    if (!assertFound(ds, res)) return;
    if (!(await assertDsAccess(req, res, ds.id))) return;

    const dsId = ds.id;

    const dscRows = await db.query.designSystemComponents.findMany({
      where: eq(designSystemComponents.designSystemId, dsId),
      with: { component: true },
    });
    const componentList = dscRows.map((r) => r.component);
    const componentIds = componentList.map((c) => c.id);

    if (componentIds.length === 0) { res.json([]); return; }

    const [variationRows, propertyRows, appearanceRows] = await Promise.all([
      db.select().from(variations).where(inArray(variations.componentId, componentIds)),
      db.select().from(properties).where(inArray(properties.componentId, componentIds)),
      db.select().from(appearances).where(
        and(
          eq(appearances.designSystemId, dsId),
          inArray(appearances.componentId, componentIds),
        ),
      ),
    ]);

    const propertyIds = propertyRows.map((p) => p.id);
    const pppRows = propertyIds.length > 0
      ? await db.select().from(propertyPlatformParams).where(inArray(propertyPlatformParams.propertyId, propertyIds))
      : [];

    // Build platformParams-like lookup: propertyId -> { xml: string[], compose: string[], ios: string[], web: string[] }
    const platformParamsByPropertyId = new Map<string, Record<string, string[]>>();
    for (const ppp of pppRows) {
      if (!platformParamsByPropertyId.has(ppp.propertyId)) {
        platformParamsByPropertyId.set(ppp.propertyId, {});
      }
      const map = platformParamsByPropertyId.get(ppp.propertyId)!;
      if (!map[ppp.platform]) map[ppp.platform] = [];
      map[ppp.platform].push(ppp.name);
    }

    const variationIds = variationRows.map((v) => v.id);
    const appearanceIds = appearanceRows.map((a) => a.id);

    const [pvRows, styleRows, ipvRows] = await Promise.all([
      variationIds.length > 0
        ? db.select().from(propertyVariations).where(inArray(propertyVariations.variationId, variationIds))
        : Promise.resolve([]),
      variationIds.length > 0
        ? db.select().from(styles).where(
            and(eq(styles.designSystemId, dsId), inArray(styles.variationId, variationIds)),
          )
        : Promise.resolve([]),
      componentIds.length > 0
        ? db.select().from(invariantPropertyValues).where(
            and(
              eq(invariantPropertyValues.designSystemId, dsId),
              inArray(invariantPropertyValues.componentId, componentIds),
              isNull(invariantPropertyValues.state),
            ),
          )
        : Promise.resolve([]),
    ]);

    const styleIds = styleRows.map((s) => s.id);

    const vpvRows =
      styleIds.length > 0 && appearanceIds.length > 0
        ? await db.select().from(variationPropertyValues).where(
            and(
              inArray(variationPropertyValues.styleId, styleIds),
              inArray(variationPropertyValues.appearanceId, appearanceIds),
            ),
          )
        : [];

    // Collect all tokenIds from vpv + ipv to resolve token names for rows where value IS NULL
    const referencedTokenIds = [
      ...new Set([
        ...vpvRows.map((r) => r.tokenId).filter(Boolean),
        ...ipvRows.map((r) => r.tokenId).filter(Boolean),
      ] as string[]),
    ];
    const tokenNameById = referencedTokenIds.length > 0
      ? new Map(
          (await db.select({ id: tokens.id, name: tokens.name }).from(tokens).where(inArray(tokens.id, referencedTokenIds)))
            .map((t) => [t.id, t.name]),
        )
      : new Map<string, string>();

    const stripScreenPrefix = (v: string) => v.replace(/^screen-\w+\./, "");

    const resolveValue = (
      value: string | null,
      tokenId: string | null,
      propType?: string | null,
    ): string | null => {
      const resolved = value ?? (tokenId ? (tokenNameById.get(tokenId) ?? null) : null);
      if (resolved && propType === "typography") return stripScreenPrefix(resolved);
      return resolved;
    };

    // ── Lookup maps ────────────────────────────────────────────────────────────
    function groupBy<T>(arr: T[], key: (item: T) => string): Map<string, T[]> {
      const map = new Map<string, T[]>();
      for (const item of arr) {
        const k = key(item);
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(item);
      }
      return map;
    }

    const propById = new Map(propertyRows.map((p) => [p.id, p]));
    const variationsByComponentId = groupBy(variationRows, (v) => v.componentId);
    const propertiesByComponentId = groupBy(propertyRows, (p) => p.componentId!);
    const pvByVariationId = groupBy(pvRows, (pv) => pv.variationId);
    const pvByPropertyId = groupBy(pvRows, (pv) => pv.propertyId);
    const appearancesByComponentId = groupBy(appearanceRows, (a) => a.componentId);
    const stylesByVariationId = groupBy(styleRows, (s) => s.variationId);
    const ipvByComponentId = groupBy(ipvRows, (ipv) => ipv.componentId);
    const ipvByComponentAppearance = groupBy(
      ipvRows,
      (ipv) => `${ipv.componentId}::${ipv.appearanceId}`,
    );
    const vpvByStyleAppearance = groupBy(
      vpvRows,
      (vpv) => `${vpv.styleId}::${vpv.appearanceId}`,
    );

    function getPlatformParam(propertyId: string, key: string): string {
      const params = platformParamsByPropertyId.get(propertyId);
      if (!params) return "";
      const arr = params[key];
      return arr?.[0] ?? "";
    }

    function buildWebMappings(
      propertyId: string,
    ): { name: string; adjustment: null }[] | null {
      const params = platformParamsByPropertyId.get(propertyId);
      const web = params?.web;
      if (!web || web.length === 0) return null;

      return web.map((name) => ({ name, adjustment: null }));
    }

    function hasAnyPlatformParam(propertyId: string): boolean {
      const params = platformParamsByPropertyId.get(propertyId);
      if (!params) return false;
      return Object.keys(params).length > 0;
    }

    const result = componentList.map((component) => {
      const compVariations = variationsByComponentId.get(component.id) ?? [];
      const compProperties = propertiesByComponentId.get(component.id) ?? [];
      const compAppearances = appearancesByComponentId.get(component.id) ?? [];

      // outer props: ipvs where tokenId IS NULL, deduplicated by propertyId
      const seenPropIds = new Set<string>();
      const outerProps = (ipvByComponentId.get(component.id) ?? [])
        .filter((ipv) => ipv.tokenId === null && !seenPropIds.has(ipv.propertyId) && seenPropIds.add(ipv.propertyId))
        .map((ipv) => ({
          id: ipv.propertyId,
          name: propById.get(ipv.propertyId)?.name ?? "",
          value: ipv.value ?? "",
          createdAt: ipv.createdAt,
          updatedAt: ipv.updatedAt,
        }));

      // sources.api: properties with at least one platform param
      const apiProperties = compProperties
        .filter((p) => hasAnyPlatformParam(p.id))
        .map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          description: p.description,
          variations: (pvByPropertyId.get(p.id) ?? []).map((pv) => pv.variationId),
          platformMappings: {
            xml: getPlatformParam(p.id, "xml") || null,
            compose: getPlatformParam(p.id, "compose") || null,
            ios: getPlatformParam(p.id, "ios") || null,
            web: buildWebMappings(p.id),
          },
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        }));

      // sources.variations: variations with their propertyVariations (tokenVariations)
      const sourcesVariations = compVariations.map((variation) => ({
        id: variation.id,
        name: variation.name,
        description: variation.description,
        createdAt: variation.createdAt,
        updatedAt: variation.updatedAt,
        tokenVariations: (pvByVariationId.get(variation.id) ?? []).map((pv) => {
          const prop = propById.get(pv.propertyId);
          return {
            id: pv.id,
            tokenId: pv.propertyId,
            token: prop
              ? {
                  id: prop.id,
                  name: prop.name,
                  type: prop.type,
                  description: prop.description,
                  defaultValue: prop.defaultValue ?? "",
                  xmlParam: getPlatformParam(prop.id, "xml"),
                  composeParam: getPlatformParam(prop.id, "compose"),
                  iosParam: getPlatformParam(prop.id, "ios"),
                  webParam: buildWebMappings(prop.id)?.[0]?.name ?? null,
                }
              : null,
          };
        }),
      }));

      // sources.configs: appearances with config
      const sourcesConfigs = compAppearances.map((appearance) => {
        // defaultVariations: isDefault styles for each variation in this DS
        const defaultVariations = compVariations.flatMap((variation) => {
          const defaultStyle = (stylesByVariationId.get(variation.id) ?? []).find(
            (s) => s.isDefault,
          );
          return defaultStyle
            ? [{ variationID: variation.id, styleID: defaultStyle.id }]
            : [];
        });

        // invariantProps: ipvs for this appearance
        const invariantProps = (
          ipvByComponentAppearance.get(`${component.id}::${appearance.id}`) ?? []
        ).map((ipv) => ({
          id: ipv.propertyId,
          value: resolveValue(ipv.value, ipv.tokenId, propById.get(ipv.propertyId)?.type) ?? "",
        }));

        // variations: each variation with its styles and vpvs
        const variationsConfig = compVariations.map((variation) => {
          const varStyles = stylesByVariationId.get(variation.id) ?? [];

          const stylesConfig = varStyles.map((style) => {
            const vpvs = vpvByStyleAppearance.get(`${style.id}::${appearance.id}`) ?? [];

            // Group vpvs: base (state IS NULL) and states
            const baseByPropId = new Map<string, (typeof vpvs)[0]>();
            const statesByPropId = new Map<string, (typeof vpvs)[0][]>();
            for (const vpv of vpvs) {
              if (vpv.state === null) {
                baseByPropId.set(vpv.propertyId, vpv);
              } else {
                if (!statesByPropId.has(vpv.propertyId)) statesByPropId.set(vpv.propertyId, []);
                statesByPropId.get(vpv.propertyId)!.push(vpv);
              }
            }

            const allPropIds = new Set([...baseByPropId.keys(), ...statesByPropId.keys()]);
            const props = [...allPropIds].map((propId) => {
              const base = baseByPropId.get(propId);
              return {
                id: propId,
                value: base ? resolveValue(base.value, base.tokenId, propById.get(propId)?.type) : null,
                states: (statesByPropId.get(propId) ?? []).map((sv) => ({
                  state: [sv.state],
                  value: resolveValue(sv.value, sv.tokenId, propById.get(propId)?.type) ?? "",
                })),
              };
            });

            return {
              name: style.name,
              id: style.id,
              intersections: null,
              props,
            };
          });

          return { id: variation.id, styles: stylesConfig };
        });

        return {
          name: appearance.name ?? "default",
          id: appearance.id,
          config: {
            defaultVariations,
            invariantProps,
            variations: variationsConfig,
          },
        };
      });

      return {
        name: component.name,
        description: component.description,
        createdAt: component.createdAt,
        updatedAt: component.updatedAt,
        props: outerProps,
        sources: {
          api: apiProperties,
          variations: sourcesVariations,
          configs: sourcesConfigs,
        },
      };
    });

    res.json(result);
  }),
);

// GET /legacy/design-systems/:name/theme-data
router.get("/:name/theme-data", optionalAuthenticate, (req, res) =>
  tryCatch(res, async () => {
    const [ds] = await db
      .select()
      .from(designSystems)
      .where(eq(designSystems.name, req.params.name));

    if (!assertFound(ds, res)) return;
    if (!(await assertDsAccess(req, res, ds.id))) return;

    const [latestVersion] = await db
      .select({ version: designSystemVersions.version })
      .from(designSystemVersions)
      .where(eq(designSystemVersions.designSystemId, ds.id))
      .orderBy(desc(designSystemVersions.publishedAt))
      .limit(1);

    const tokenRows = await db
      .select()
      .from(tokens)
      .where(eq(tokens.designSystemId, ds.id));

    const tokenIds = tokenRows.map((t) => t.id);

    const tokenValueRows =
      tokenIds.length > 0
        ? await db
            .select({
              tokenId: tokenValues.tokenId,
              platform: tokenValues.platform,
              mode: tokenValues.mode,
              value: tokenValues.value,
              paletteType: palette.type,
              paletteShade: palette.shade,
              paletteSaturation: palette.saturation,
            })
            .from(tokenValues)
            .leftJoin(palette, eq(tokenValues.paletteId, palette.id))
            .where(inArray(tokenValues.tokenId, tokenIds))
        : [];

    const tokenById = new Map(tokenRows.map((t) => [t.id, t]));

    const extractUnique = (type: string, pos: number) => [
      ...new Set(
        tokenRows
          .filter((t) => t.type === type)
          .map((t) => t.name.split(".")[pos])
          .filter(Boolean),
      ),
    ];

    const extractMode = (tokenType: string) => [
      ...new Set(
        tokenValueRows
          .filter(
            (tv) =>
              tv.tokenId != null &&
              tv.mode != null &&
              tokenById.get(tv.tokenId)?.type === tokenType,
          )
          .map((tv) => tv.mode as string),
      ),
    ];

    const tokenModes = new Map<string, Set<string>>();
    for (const tv of tokenValueRows) {
      if (!tv.tokenId || !tv.mode) continue;
      if (!tokenModes.has(tv.tokenId)) tokenModes.set(tv.tokenId, new Set());
      tokenModes.get(tv.tokenId)!.add(tv.mode);
    }

    const metaTokens = tokenRows.flatMap((t) => {
      const modes = tokenModes.get(t.id);
      if (modes && modes.size > 0) {
        return [...modes].map((mode) => {
          const fullName = `${mode}.${t.name}`;
          return {
            name: fullName,
            tags: fullName.split("."),
            type: t.type,
            enabled: t.enabled,
            description: t.description,
            displayName: t.displayName,
          };
        });
      }
      return [
        {
          name: t.name,
          tags: t.name.split("."),
          type: t.type,
          enabled: t.enabled,
          description: t.description,
          displayName: t.displayName,
        },
      ];
    });

    const meta = {
      name: ds.name,
      version: latestVersion?.version ?? null,
      tokens: metaTokens,
      color: {
        mode: extractMode("color"),
        category: extractUnique("color", 0),
        subcategory: extractUnique("color", 1),
      },
      gradient: {
        mode: extractMode("gradient"),
        category: extractUnique("gradient", 0),
        subcategory: extractUnique("gradient", 1),
      },
      shape: {
        kind: extractUnique("shape", 0),
        size: extractUnique("shape", 1),
      },
      shadow: {
        direction: extractUnique("shadow", 0),
        kind: extractUnique("shadow", 1),
        size: extractUnique("shadow", 2),
      },
      spacing: {
        kind: extractUnique("spacing", 0),
        size: extractUnique("spacing", 1),
      },
      typography: {
        screen: extractUnique("typography", 0),
        kind: extractUnique("typography", 1),
        size: extractUnique("typography", 2),
        weight: extractUnique("typography", 3),
      },
      fontFamily: {
        kind: extractUnique("fontFamily", 0),
      },
    };

    const variations: Record<string, Record<string, Record<string, unknown>>> =
      {};

    for (const tv of tokenValueRows) {
      if (!tv.tokenId || !tv.platform) continue;
      const token = tokenById.get(tv.tokenId);
      if (!token?.type) continue;

      let value: unknown;
      if (tv.paletteType != null) {
        value = `[${tv.paletteType}.${tv.paletteShade}.${tv.paletteSaturation}]`;
      } else if (token.type === "shadow" || token.type === "gradient") {
        value = tv.value;
      } else {
        value = Array.isArray(tv.value) ? tv.value[0] : tv.value;
      }

      const key = tv.mode != null ? `${tv.mode}.${token.name}` : token.name;

      variations[token.type] ??= {};
      variations[token.type][tv.platform] ??= {};
      variations[token.type][tv.platform][key] = value;
    }

    res.json({ meta, variations });
  }),
);

// GET /legacy/design-systems/:name/tenant-params
router.get("/:name/tenant-params", optionalAuthenticate, (req, res) =>
  tryCatch(res, async () => {
    const [ds] = await db
      .select()
      .from(designSystems)
      .where(eq(designSystems.name, req.params.name));

    if (!assertFound(ds, res)) return;
    if (!(await assertDsAccess(req, res, ds.id))) return;

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.designSystemId, ds.id))
      .limit(1);

    if (!assertFound(tenant, res)) return;

    const cfg = tenant.colorConfig ?? {};

    res.json({
      projectName: ds.projectName,
      packagesName: ds.name,
      grayTone: cfg.grayTone ?? null,
      accentColor: cfg.accentColor ?? null,
      lightStrokeSaturation: cfg.light?.strokeSaturation ?? null,
      lightFillSaturation: cfg.light?.fillSaturation ?? null,
      darkStrokeSaturation: cfg.dark?.strokeSaturation ?? null,
      darkFillSaturation: cfg.dark?.fillSaturation ?? null,
    });
  }),
);

// POST /legacy/design-systems/create
// Создаёт дизайн-систему на основе legacy JSON-структуры
router.post("/create", optionalAuthenticate, (req, res) =>
  tryCatch(res, async () => {
    const body = req.body as LegacyImportBody;
    const { name, version, parameters, themeData, componentsData } = body;

    const projectName = parameters.projectName ?? name;
    const packagesName = parameters.packagesName ?? name;

    // ── 1. Design system ────────────────────────────────────────────────────
    const [ds] = await db
      .insert(designSystems)
      .values({ name: packagesName, projectName })
      .returning();

    // ── 2. Tenant ────────────────────────────────────────────────────────────
    const tenantName = `${name}_default`;
    const colorConfig: {
      grayTone?: string;
      accentColor?: string;
      light?: { strokeSaturation: number; fillSaturation: number };
      dark?: { strokeSaturation: number; fillSaturation: number };
    } = {};
    if (parameters.grayTone) colorConfig.grayTone = parameters.grayTone;
    if (parameters.accentColor) colorConfig.accentColor = parameters.accentColor;
    if (parameters.lightStrokeSaturation !== undefined && parameters.lightFillSaturation !== undefined) {
      colorConfig.light = {
        strokeSaturation: parameters.lightStrokeSaturation,
        fillSaturation: parameters.lightFillSaturation,
      };
    }
    if (parameters.darkStrokeSaturation !== undefined && parameters.darkFillSaturation !== undefined) {
      colorConfig.dark = {
        strokeSaturation: parameters.darkStrokeSaturation,
        fillSaturation: parameters.darkFillSaturation,
      };
    }
    const [tenant] = await db
      .insert(tenants)
      .values({
        designSystemId: ds.id,
        name: tenantName,
        colorConfig,
      })
      .returning();

    // ── 3. Tokens + token_values ─────────────────────────────────────────────
    if (themeData?.meta?.tokens?.length) {
      const stripMode = (name: string) =>
        name.startsWith("dark.") || name.startsWith("light.")
          ? name.slice(name.indexOf(".") + 1)
          : name;

      // Deduplicate tokens by stripped name (dark./light. prefix → mode)
      const tokenMap = new Map<string, LegacyToken>();
      for (const t of themeData.meta.tokens) {
        const strippedName = stripMode(t.name);
        if (!tokenMap.has(strippedName)) {
          tokenMap.set(strippedName, t);
        }
      }

      const tokenInserts = [...tokenMap.entries()].map(([strippedName, t]) => ({
        designSystemId: ds.id,
        name: strippedName,
        type: t.type as any,
        displayName: t.displayName ?? null,
        description: t.description ?? null,
        enabled: t.enabled ?? true,
      }));
      const insertedTokens = await db.insert(tokens).values(tokenInserts).returning();
      const tokenByName = new Map(insertedTokens.map((t) => [t.name, t]));

      // token_values: variations[type][platform][tokenName] = value
      const tvInserts: {
        tokenId: string;
        tenantId: string;
        platform: "web" | "android" | "ios";
        mode: "light" | "dark" | null;
        value: any;
      }[] = [];

      const vars = themeData.variations ?? {};
      for (const [_tokenType, platformMap] of Object.entries(vars as Record<string, Record<string, Record<string, unknown>>>)) {
        for (const [platform, tokenMap] of Object.entries(platformMap)) {
          for (const [tokenKey, rawValue] of Object.entries(tokenMap)) {
            // tokenKey может быть "dark.text.default.primary" или "text.default.primary"
            // Ищем токен по имени без префикса режима
            let mode: "light" | "dark" | null = null;
            let tokenName = tokenKey;
            if (tokenKey.startsWith("dark.") || tokenKey.startsWith("light.")) {
              const dotIdx = tokenKey.indexOf(".");
              mode = tokenKey.slice(0, dotIdx) as "light" | "dark";
              tokenName = tokenKey.slice(dotIdx + 1);
            }

            const token = tokenByName.get(tokenName);
            if (!token) continue;

            // Определяем value
            let value: any;
            if (
              typeof rawValue === "string" &&
              rawValue.startsWith("[") &&
              rawValue.endsWith("]")
            ) {
              // palette ref — храним как есть в jsonb
              value = [rawValue];
            } else if (Array.isArray(rawValue)) {
              value = rawValue;
            } else {
              value = [rawValue];
            }

            tvInserts.push({
              tokenId: token.id,
              tenantId: tenant.id,
              platform: platform as "web" | "android" | "ios",
              mode,
              value,
            });
          }
        }
      }

      if (tvInserts.length > 0) {
        await db.insert(tokenValues).values(tvInserts);
      }
    }

    // ── 4. Design system version ─────────────────────────────────────────────
    if (version) {
      await db.insert(designSystemVersions).values({
        designSystemId: ds.id,
        version,
        snapshot: body as any,
        publicationStatus: "published",
      });
    }

    // ── 5. Components data ────────────────────────────────────────────────────
    if (!componentsData?.length) {
      res.status(201).json({ id: ds.id });
      return;
    }

    // Загружаем компоненты по имени
    const compNames = componentsData.map((c: LegacyComponent) => c.name);
    const existingComponents = await db
      .select()
      .from(components)
      .where(inArray(components.name, compNames));
    const componentByName = new Map(existingComponents.map((c) => [c.name, c]));

    // Загружаем variations для этих компонентов
    const compIds = existingComponents.map((c) => c.id);
    const [allVariations, allProperties] = compIds.length > 0
      ? await Promise.all([
          db.select().from(variations).where(inArray(variations.componentId, compIds)),
          db.select().from(properties).where(inArray(properties.componentId, compIds)),
        ])
      : [[], []];

    // variation по componentId+name
    const variationByCompAndName = new Map<string, typeof allVariations[0]>();
    for (const v of allVariations) {
      variationByCompAndName.set(`${v.componentId}::${v.name}`, v);
    }

    // property по componentId+name+type
    const propertyByCompNameType = new Map<string, typeof allProperties[0]>();
    for (const p of allProperties) {
      propertyByCompNameType.set(`${p.componentId}::${p.name}::${p.type}`, p);
    }

    // property_platform_params: propertyId -> platform -> name -> ppp row
    const allPropIds = allProperties.map((p) => p.id);
    const allPPP = allPropIds.length > 0
      ? await db.select().from(propertyPlatformParams).where(inArray(propertyPlatformParams.propertyId, allPropIds))
      : [];
    // ppp по propertyId+platform+name
    const pppByKey = new Map<string, typeof allPPP[0]>();
    for (const ppp of allPPP) {
      pppByKey.set(`${ppp.propertyId}::${ppp.platform}::${ppp.name}`, ppp);
    }

    for (const compData of componentsData as LegacyComponent[]) {
      const component = componentByName.get(compData.name);
      if (!component) continue;

      // Линкуем компонент к ДС
      await db
        .insert(designSystemComponents)
        .values({ designSystemId: ds.id, componentId: component.id })
        .onConflictDoNothing();

      const { sources } = compData;
      if (!sources) continue;

      // Строим маппинг jsonId -> { dbProperty, platformParams }
      // jsonId — UUID из JSON (не БД)
      type ApiPropInfo = {
        dbProp: typeof allProperties[0] | undefined;
        platformMappings: {
          xml: string | null;
          compose: string | null;
          ios: string | null;
          web: { name: string; adjustment: string | null }[] | null;
        };
      };
      const apiPropById = new Map<string, ApiPropInfo>();
      for (const apiProp of (sources.api ?? []) as LegacyApiProp[]) {
        const dbProp = propertyByCompNameType.get(
          `${component.id}::${apiProp.name}::${apiProp.type}`,
        );
        apiPropById.set(apiProp.id, {
          dbProp,
          platformMappings: {
            xml: typeof apiProp.platformMappings?.xml === "string"
              ? apiProp.platformMappings.xml
              : null,
            compose: typeof apiProp.platformMappings?.compose === "string"
              ? apiProp.platformMappings.compose
              : null,
            ios: typeof apiProp.platformMappings?.ios === "string"
              ? apiProp.platformMappings.ios
              : null,
            web: Array.isArray(apiProp.platformMappings?.web)
              ? apiProp.platformMappings.web
              : null,
          },
        });
      }

      // Строим маппинг jsonVariationId -> dbVariation
      const jsonVarToDbVar = new Map<string, typeof allVariations[0]>();
      for (const srcVar of (sources.variations ?? []) as LegacySrcVariation[]) {
        const dbVar = variationByCompAndName.get(`${component.id}::${srcVar.name}`);
        if (dbVar) jsonVarToDbVar.set(srcVar.id, dbVar);
      }

      // Стили создаются один раз per компонент (не per appearance).
      // Берём первый config для определения defaultVariations и styles.
      const firstConfig = (sources.configs ?? [])[0] as LegacyConfig | undefined;
      const jsonStyleToDbStyle = new Map<string, typeof styles.$inferSelect>();

      if (firstConfig) {
        const defaultStyleByJsonVarId = new Map<string, string>();
        for (const dv of firstConfig.config.defaultVariations ?? []) {
          defaultStyleByJsonVarId.set(dv.variationID, dv.styleID);
        }
        for (const varCfg of firstConfig.config.variations ?? []) {
          const dbVar = jsonVarToDbVar.get(varCfg.id);
          if (!dbVar) continue;
          for (const styleCfg of varCfg.styles ?? []) {
            const isDefault = defaultStyleByJsonVarId.get(varCfg.id) === styleCfg.id;
            const [dbStyle] = await db
              .insert(styles)
              .values({
                designSystemId: ds.id,
                variationId: dbVar.id,
                name: styleCfg.name,
                isDefault,
              })
              .returning();
            jsonStyleToDbStyle.set(styleCfg.id, dbStyle);
          }
        }
      }

      // Для каждого config (appearance)
      for (const configEntry of (sources.configs ?? []) as LegacyConfig[]) {
        // Создаём appearance
        const [appearance] = await db
          .insert(appearances)
          .values({
            designSystemId: ds.id,
            componentId: component.id,
            name: configEntry.name,
          })
          .returning();

        const cfg = configEntry.config;

        // invariantProps
        for (const inv of cfg.invariantProps ?? []) {
          const info = apiPropById.get(inv.id);
          if (!info?.dbProp) continue;

          const valueStr = inv.value !== null && inv.value !== undefined
            ? String(inv.value)
            : null;

          const [ipv] = await db
            .insert(invariantPropertyValues)
            .values({
              propertyId: info.dbProp.id,
              designSystemId: ds.id,
              componentId: component.id,
              appearanceId: appearance.id,
              value: valueStr,
              state: (inv.states ? null : null) as any,
            })
            .returning();

          // Создаём adjustments для каждой платформы
          await insertInvariantAdjustments(
            ipv.id,
            info,
            valueStr,
            pppByKey,
          );
        }

        // variation props (vpv)
        for (const varCfg of cfg.variations ?? []) {
          for (const styleCfg of varCfg.styles ?? []) {
            const dbStyle = jsonStyleToDbStyle.get(styleCfg.id);
            if (!dbStyle) continue;

            for (const prop of styleCfg.props ?? []) {
              const info = apiPropById.get(prop.id);
              if (!info?.dbProp) continue;

              const valueStr = prop.value !== null && prop.value !== undefined
                ? String(prop.value)
                : null;

              // base VPV (без state)
              const [vpv] = await db
                .insert(variationPropertyValues)
                .values({
                  propertyId: info.dbProp.id,
                  styleId: dbStyle.id,
                  appearanceId: appearance.id,
                  value: valueStr,
                  state: null,
                })
                .returning();

              await insertVariationAdjustments(vpv.id, info, valueStr, pppByKey);

              // states
              for (const stateEntry of prop.states ?? []) {
                const stateVal = Array.isArray(stateEntry.state)
                  ? stateEntry.state[0]
                  : stateEntry.state;
                if (!stateVal) continue;

                const stateValueStr = stateEntry.value !== null && stateEntry.value !== undefined
                  ? String(stateEntry.value)
                  : null;

                const [svpv] = await db
                  .insert(variationPropertyValues)
                  .values({
                    propertyId: info.dbProp.id,
                    styleId: dbStyle.id,
                    appearanceId: appearance.id,
                    value: stateValueStr,
                    state: stateVal as any,
                  })
                  .returning();

                await insertVariationAdjustments(svpv.id, info, stateValueStr, pppByKey);
              }
            }
          }
        }
      }
    }

    res.status(201).json({ id: ds.id });
  }),
);

// POST /legacy/design-systems/:name/update
// Обновляет существующую дизайн-систему на основе legacy JSON-структуры
router.post("/:name/update", optionalAuthenticate, (req, res) =>
  tryCatch(res, async () => {
    const body = req.body as LegacyImportBody;
    const { themeData, componentsData } = body;

    // ── 1. Find existing design system ──────────────────────────────────────
    const [ds] = await db
      .select()
      .from(designSystems)
      .where(eq(designSystems.name, req.params.name));

    if (!assertFound(ds, res)) return;
    if (!(await assertDsAccess(req, res, ds.id))) return;

    // ── 2. Tenant (find existing, no colorConfig update) ─────────────────────
    const tenantName = `${req.params.name}_default`;
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(and(eq(tenants.designSystemId, ds.id), eq(tenants.name, tenantName)));

    if (!assertFound(tenant, res)) return;

    // ── 3. Tokens + token_values ─────────────────────────────────────────────
    if (themeData?.meta?.tokens?.length) {
      const stripMode = (name: string) =>
        name.startsWith("dark.") || name.startsWith("light.")
          ? name.slice(name.indexOf(".") + 1)
          : name;

      // Deduplicate tokens by stripped name
      const tokenMap = new Map<string, LegacyToken>();
      for (const t of themeData.meta.tokens) {
        const strippedName = stripMode(t.name);
        if (!tokenMap.has(strippedName)) {
          tokenMap.set(strippedName, t);
        }
      }

      // Load existing tokens for this DS
      const existingTokens = await db
        .select()
        .from(tokens)
        .where(eq(tokens.designSystemId, ds.id));
      const existingTokenByName = new Map(existingTokens.map((t) => [t.name, t]));

      // Upsert tokens
      const tokenByName = new Map<string, typeof tokens.$inferSelect>();
      for (const [strippedName, t] of tokenMap.entries()) {
        const existing = existingTokenByName.get(strippedName);
        if (existing) {
          const [updated] = await db
            .update(tokens)
            .set({
              type: t.type as any,
              displayName: t.displayName ?? null,
              description: t.description ?? null,
              enabled: t.enabled ?? true,
            })
            .where(eq(tokens.id, existing.id))
            .returning();
          tokenByName.set(strippedName, updated);
        } else {
          const [inserted] = await db
            .insert(tokens)
            .values({
              designSystemId: ds.id,
              name: strippedName,
              type: t.type as any,
              displayName: t.displayName ?? null,
              description: t.description ?? null,
              enabled: t.enabled ?? true,
            })
            .returning();
          tokenByName.set(strippedName, inserted);
        }
      }

      // Delete token_values for this tenant, then re-insert
      const allTokenIds = [...tokenByName.values()].map((t) => t.id);
      if (allTokenIds.length > 0) {
        await db
          .delete(tokenValues)
          .where(
            and(
              inArray(tokenValues.tokenId, allTokenIds),
              eq(tokenValues.tenantId, tenant.id),
            ),
          );
      }

      const tvInserts: {
        tokenId: string;
        tenantId: string;
        platform: "web" | "android" | "ios";
        mode: "light" | "dark" | null;
        value: any;
      }[] = [];

      const vars = themeData.variations ?? {};
      for (const [_tokenType, platformMap] of Object.entries(vars as Record<string, Record<string, Record<string, unknown>>>)) {
        for (const [platform, tokenMap] of Object.entries(platformMap)) {
          for (const [tokenKey, rawValue] of Object.entries(tokenMap)) {
            let mode: "light" | "dark" | null = null;
            let tokenName = tokenKey;
            if (tokenKey.startsWith("dark.") || tokenKey.startsWith("light.")) {
              const dotIdx = tokenKey.indexOf(".");
              mode = tokenKey.slice(0, dotIdx) as "light" | "dark";
              tokenName = tokenKey.slice(dotIdx + 1);
            }

            const token = tokenByName.get(tokenName);
            if (!token) continue;

            let value: any;
            if (
              typeof rawValue === "string" &&
              rawValue.startsWith("[") &&
              rawValue.endsWith("]")
            ) {
              value = [rawValue];
            } else if (Array.isArray(rawValue)) {
              value = rawValue;
            } else {
              value = [rawValue];
            }

            tvInserts.push({
              tokenId: token.id,
              tenantId: tenant.id,
              platform: platform as "web" | "android" | "ios",
              mode,
              value,
            });
          }
        }
      }

      if (tvInserts.length > 0) {
        await db.insert(tokenValues).values(tvInserts);
      }
    }

    // ── 4. Components data ────────────────────────────────────────────────────
    if (!componentsData?.length) {
      res.json({ id: ds.id });
      return;
    }

    const compNames = componentsData.map((c: LegacyComponent) => c.name);
    const existingComponents = await db
      .select()
      .from(components)
      .where(inArray(components.name, compNames));
    const componentByName = new Map(existingComponents.map((c) => [c.name, c]));

    const compIds = existingComponents.map((c) => c.id);
    const [allVariations, allProperties] = compIds.length > 0
      ? await Promise.all([
          db.select().from(variations).where(inArray(variations.componentId, compIds)),
          db.select().from(properties).where(inArray(properties.componentId, compIds)),
        ])
      : [[], []];

    const variationByCompAndName = new Map<string, typeof allVariations[0]>();
    for (const v of allVariations) {
      variationByCompAndName.set(`${v.componentId}::${v.name}`, v);
    }

    const propertyByCompNameType = new Map<string, typeof allProperties[0]>();
    for (const p of allProperties) {
      propertyByCompNameType.set(`${p.componentId}::${p.name}::${p.type}`, p);
    }

    const allPropIds = allProperties.map((p) => p.id);
    const allPPP = allPropIds.length > 0
      ? await db.select().from(propertyPlatformParams).where(inArray(propertyPlatformParams.propertyId, allPropIds))
      : [];
    const pppByKey = new Map<string, typeof allPPP[0]>();
    for (const ppp of allPPP) {
      pppByKey.set(`${ppp.propertyId}::${ppp.platform}::${ppp.name}`, ppp);
    }

    for (const compData of componentsData as LegacyComponent[]) {
      const component = componentByName.get(compData.name);
      if (!component) continue;

      // Link component to DS
      await db
        .insert(designSystemComponents)
        .values({ designSystemId: ds.id, componentId: component.id })
        .onConflictDoNothing();

      const { sources } = compData;
      if (!sources) continue;

      type ApiPropInfo = {
        dbProp: typeof allProperties[0] | undefined;
        platformMappings: {
          xml: string | null;
          compose: string | null;
          ios: string | null;
          web: { name: string; adjustment: string | null }[] | null;
        };
      };
      const apiPropById = new Map<string, ApiPropInfo>();
      for (const apiProp of (sources.api ?? []) as LegacyApiProp[]) {
        const dbProp = propertyByCompNameType.get(
          `${component.id}::${apiProp.name}::${apiProp.type}`,
        );
        apiPropById.set(apiProp.id, {
          dbProp,
          platformMappings: {
            xml: typeof apiProp.platformMappings?.xml === "string"
              ? apiProp.platformMappings.xml
              : null,
            compose: typeof apiProp.platformMappings?.compose === "string"
              ? apiProp.platformMappings.compose
              : null,
            ios: typeof apiProp.platformMappings?.ios === "string"
              ? apiProp.platformMappings.ios
              : null,
            web: Array.isArray(apiProp.platformMappings?.web)
              ? apiProp.platformMappings.web
              : null,
          },
        });
      }

      const jsonVarToDbVar = new Map<string, typeof allVariations[0]>();
      for (const srcVar of (sources.variations ?? []) as LegacySrcVariation[]) {
        const dbVar = variationByCompAndName.get(`${component.id}::${srcVar.name}`);
        if (dbVar) jsonVarToDbVar.set(srcVar.id, dbVar);
      }

      // Delete existing styles, appearances, ipv, vpv for this DS + component
      // so we can re-create them from the incoming data
      const existingAppearances = await db
        .select()
        .from(appearances)
        .where(
          and(
            eq(appearances.designSystemId, ds.id),
            eq(appearances.componentId, component.id),
          ),
        );
      const existingAppearanceIds = existingAppearances.map((a) => a.id);

      const existingStyles = await db
        .select()
        .from(styles)
        .where(eq(styles.designSystemId, ds.id));
      const compVariationIds = (allVariations)
        .filter((v) => v.componentId === component.id)
        .map((v) => v.id);
      const compStyleIds = existingStyles
        .filter((s) => compVariationIds.includes(s.variationId))
        .map((s) => s.id);

      // Delete vpv + adjustments
      if (compStyleIds.length > 0 && existingAppearanceIds.length > 0) {
        const existingVpvs = await db
          .select({ id: variationPropertyValues.id })
          .from(variationPropertyValues)
          .where(
            and(
              inArray(variationPropertyValues.styleId, compStyleIds),
              inArray(variationPropertyValues.appearanceId, existingAppearanceIds),
            ),
          );
        const vpvIds = existingVpvs.map((v) => v.id);
        if (vpvIds.length > 0) {
          await db.delete(variationPlatformParamAdjustments).where(
            inArray(variationPlatformParamAdjustments.vpvId, vpvIds),
          );
          await db.delete(variationPropertyValues).where(
            inArray(variationPropertyValues.id, vpvIds),
          );
        }
      }

      // Delete ipv + adjustments
      if (existingAppearanceIds.length > 0) {
        const existingIpvs = await db
          .select({ id: invariantPropertyValues.id })
          .from(invariantPropertyValues)
          .where(
            and(
              eq(invariantPropertyValues.designSystemId, ds.id),
              eq(invariantPropertyValues.componentId, component.id),
              inArray(invariantPropertyValues.appearanceId, existingAppearanceIds),
            ),
          );
        const ipvIds = existingIpvs.map((v) => v.id);
        if (ipvIds.length > 0) {
          await db.delete(invariantPlatformParamAdjustments).where(
            inArray(invariantPlatformParamAdjustments.ipvId, ipvIds),
          );
          await db.delete(invariantPropertyValues).where(
            inArray(invariantPropertyValues.id, ipvIds),
          );
        }
      }

      // Delete existing styles for this DS + component's variations
      if (compStyleIds.length > 0) {
        await db.delete(styles).where(inArray(styles.id, compStyleIds));
      }

      // Delete existing appearances
      if (existingAppearanceIds.length > 0) {
        await db.delete(appearances).where(inArray(appearances.id, existingAppearanceIds));
      }

      // Re-create styles from first config
      const firstConfig = (sources.configs ?? [])[0] as LegacyConfig | undefined;
      const jsonStyleToDbStyle = new Map<string, typeof styles.$inferSelect>();

      if (firstConfig) {
        const defaultStyleByJsonVarId = new Map<string, string>();
        for (const dv of firstConfig.config.defaultVariations ?? []) {
          defaultStyleByJsonVarId.set(dv.variationID, dv.styleID);
        }
        for (const varCfg of firstConfig.config.variations ?? []) {
          const dbVar = jsonVarToDbVar.get(varCfg.id);
          if (!dbVar) continue;
          for (const styleCfg of varCfg.styles ?? []) {
            const isDefault = defaultStyleByJsonVarId.get(varCfg.id) === styleCfg.id;
            const [dbStyle] = await db
              .insert(styles)
              .values({
                designSystemId: ds.id,
                variationId: dbVar.id,
                name: styleCfg.name,
                isDefault,
              })
              .returning();
            jsonStyleToDbStyle.set(styleCfg.id, dbStyle);
          }
        }
      }

      // Re-create appearances, ipv, vpv
      for (const configEntry of (sources.configs ?? []) as LegacyConfig[]) {
        const [appearance] = await db
          .insert(appearances)
          .values({
            designSystemId: ds.id,
            componentId: component.id,
            name: configEntry.name,
          })
          .returning();

        const cfg = configEntry.config;

        // invariantProps
        for (const inv of cfg.invariantProps ?? []) {
          const info = apiPropById.get(inv.id);
          if (!info?.dbProp) continue;

          const valueStr = inv.value !== null && inv.value !== undefined
            ? String(inv.value)
            : null;

          const [ipv] = await db
            .insert(invariantPropertyValues)
            .values({
              propertyId: info.dbProp.id,
              designSystemId: ds.id,
              componentId: component.id,
              appearanceId: appearance.id,
              value: valueStr,
              state: (inv.states ? null : null) as any,
            })
            .returning();

          await insertInvariantAdjustments(ipv.id, info, valueStr, pppByKey);
        }

        // variation props (vpv)
        for (const varCfg of cfg.variations ?? []) {
          for (const styleCfg of varCfg.styles ?? []) {
            const dbStyle = jsonStyleToDbStyle.get(styleCfg.id);
            if (!dbStyle) continue;

            for (const prop of styleCfg.props ?? []) {
              const info = apiPropById.get(prop.id);
              if (!info?.dbProp) continue;

              const valueStr = prop.value !== null && prop.value !== undefined
                ? String(prop.value)
                : null;

              const [vpv] = await db
                .insert(variationPropertyValues)
                .values({
                  propertyId: info.dbProp.id,
                  styleId: dbStyle.id,
                  appearanceId: appearance.id,
                  value: valueStr,
                  state: null,
                })
                .returning();

              await insertVariationAdjustments(vpv.id, info, valueStr, pppByKey);

              // states
              for (const stateEntry of prop.states ?? []) {
                const stateVal = Array.isArray(stateEntry.state)
                  ? stateEntry.state[0]
                  : stateEntry.state;
                if (!stateVal) continue;

                const stateValueStr = stateEntry.value !== null && stateEntry.value !== undefined
                  ? String(stateEntry.value)
                  : null;

                const [svpv] = await db
                  .insert(variationPropertyValues)
                  .values({
                    propertyId: info.dbProp.id,
                    styleId: dbStyle.id,
                    appearanceId: appearance.id,
                    value: stateValueStr,
                    state: stateVal as any,
                  })
                  .returning();

                await insertVariationAdjustments(svpv.id, info, stateValueStr, pppByKey);
              }
            }
          }
        }
      }
    }

    res.json({ id: ds.id });
  }),
);

// ── Helpers ──────────────────────────────────────────────────────────────────

type PppRow = { id: string; propertyId: string; platform: string; name: string };

async function insertVariationAdjustments(
  vpvId: string,
  info: { dbProp: { id: string } | undefined; platformMappings: { xml: string | null; compose: string | null; ios: string | null; web: { name: string; adjustment: string | null }[] | null } },
  value: string | null,
  pppByKey: Map<string, PppRow>,
) {
  const rows = buildAdjustmentRows(info, value, pppByKey);
  for (const row of rows) {
    await db.insert(variationPlatformParamAdjustments).values({
      vpvId,
      platformParamId: row.platformParamId,
      value: row.value,
      template: row.template,
    }).onConflictDoNothing();
  }
}

async function insertInvariantAdjustments(
  ipvId: string,
  info: { dbProp: { id: string } | undefined; platformMappings: { xml: string | null; compose: string | null; ios: string | null; web: { name: string; adjustment: string | null }[] | null } },
  value: string | null,
  pppByKey: Map<string, PppRow>,
) {
  const rows = buildAdjustmentRows(info, value, pppByKey);
  for (const row of rows) {
    await db.insert(invariantPlatformParamAdjustments).values({
      ipvId,
      platformParamId: row.platformParamId,
      value: row.value,
      template: row.template,
    }).onConflictDoNothing();
  }
}

function buildAdjustmentRows(
  info: { dbProp: { id: string } | undefined; platformMappings: { xml: string | null; compose: string | null; ios: string | null; web: { name: string; adjustment: string | null }[] | null } },
  value: string | null,
  pppByKey: Map<string, PppRow>,
): { platformParamId: string; value: string | null; template: string | null }[] {
  if (!info.dbProp) return [];
  const propId = info.dbProp.id;
  const rows: { platformParamId: string; value: string | null; template: string | null }[] = [];

  // xml
  if (info.platformMappings.xml) {
    const ppp = pppByKey.get(`${propId}::xml::${info.platformMappings.xml}`);
    if (ppp && (value !== null)) {
      rows.push({ platformParamId: ppp.id, value, template: null });
    }
  }
  // compose
  if (info.platformMappings.compose) {
    const ppp = pppByKey.get(`${propId}::compose::${info.platformMappings.compose}`);
    if (ppp && (value !== null)) {
      rows.push({ platformParamId: ppp.id, value, template: null });
    }
  }
  // ios
  if (info.platformMappings.ios) {
    const ppp = pppByKey.get(`${propId}::ios::${info.platformMappings.ios}`);
    if (ppp && (value !== null)) {
      rows.push({ platformParamId: ppp.id, value, template: null });
    }
  }
  // web
  for (const webEntry of info.platformMappings.web ?? []) {
    const ppp = pppByKey.get(`${propId}::web::${webEntry.name}`);
    if (!ppp) continue;
    const hasValue = value !== null;
    const hasTemplate = webEntry.adjustment !== null && webEntry.adjustment !== undefined;
    if (hasValue || hasTemplate) {
      rows.push({
        platformParamId: ppp.id,
        value: hasValue ? value : null,
        template: hasTemplate ? webEntry.adjustment : null,
      });
    }
  }

  return rows;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface LegacyImportBody {
  name: string;
  version: string;
  parameters: {
    projectName?: string;
    packagesName?: string;
    grayTone?: string;
    accentColor?: string;
    lightStrokeSaturation?: number;
    lightFillSaturation?: number;
    darkStrokeSaturation?: number;
    darkFillSaturation?: number;
  };
  themeData?: {
    meta?: {
      tokens?: LegacyToken[];
    };
    variations?: Record<string, Record<string, Record<string, unknown>>>;
  };
  componentsData?: LegacyComponent[];
}

interface LegacyToken {
  type: string;
  name: string;
  displayName?: string;
  description?: string;
  enabled?: boolean;
}

interface LegacyComponent {
  name: string;
  description?: string;
  sources?: {
    api?: LegacyApiProp[];
    variations?: LegacySrcVariation[];
    configs?: LegacyConfig[];
  };
}

interface LegacyApiProp {
  id: string;
  name: string;
  type: string;
  description?: string;
  variations?: string[] | null;
  platformMappings?: {
    xml?: string | null;
    compose?: string | null;
    ios?: string | null;
    web?: { name: string; adjustment: string | null }[] | null;
  };
}

interface LegacySrcVariation {
  id: string;
  name: string;
}

interface LegacyConfig {
  name: string;
  id: string;
  config: {
    defaultVariations?: { variationID: string; styleID: string }[];
    invariantProps?: { id: string; value: unknown; states?: unknown }[];
    variations?: {
      id: string;
      styles?: {
        name: string;
        id: string;
        props?: {
          id: string;
          value: unknown;
          states?: { state: string | string[]; value: unknown }[];
        }[];
      }[];
    }[];
  };
}

export default router;
