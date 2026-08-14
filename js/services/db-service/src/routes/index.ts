import { Router } from "express";
import { spec } from "../openapi/spec";
import designSystemsRouter from "./api/design-systems";
import designSystemVersionsRouter from "./api/design-system-versions";
import componentsRouter from "./api/components";
import componentsImportRouter from "./api/components-import";
import componentStatesRouter from "./api/component-states";
import designSystemComponentsRouter from "./api/design-system-components";
import variationsRouter from "./api/variations";
import propertiesRouter from "./api/properties";
import propertyPlatformParamsRouter from "./api/property-platform-params";
import variationPlatformParamAdjustmentsRouter from "./api/variation-platform-param-adjustments";
import invariantPlatformParamAdjustmentsRouter from "./api/invariant-platform-param-adjustments";
import propertyVariationsRouter from "./api/property-variations";
import appearancesRouter from "./api/appearances";
import stylesRouter from "./api/styles";
import tokensRouter from "./api/tokens";
import tenantsRouter from "./api/tenants";
import tokenValuesRouter from "./api/token-values";
import variationPropertyValuesRouter from "./api/variation-property-values";
import invariantPropertyValuesRouter from "./api/invariant-property-values";
import documentationPagesRouter from "./api/documentation-pages";
import componentDepsRouter from "./api/component-deps";
import componentReuseConfigsRouter from "./api/component-reuse-configs";
import styleCombinationsRouter from "./api/style-combinations";
import styleCombinationMembersRouter from "./api/style-combination-members";
import designSystemChangesRouter from "./api/design-system-changes";
import savedQueriesRouter from "./api/saved-queries";
import paletteRouter from "./api/palette";
import legacyRouter from "./api/legacy";
import componentConfigRouter from "./api/component-config";

// Misc (legacy utility routes)
import tablesRouter from "./misc/tables";
import queriesRouter from "./misc/queries";
import nlQueryRouter from "./misc/nl-query";
import schemaRouter from "./misc/schema";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/openapi.json", (_req, res) => {
  res.json(spec);
});

// Resource routes
// Импорт компонентов монтируется до основного роутера дизайн-систем: путь содержит
// двоеточие и разбирается отдельным шаблоном.
router.use("/ds/design-systems", componentsImportRouter);
router.use("/ds/design-systems", designSystemsRouter);
router.use("/ds/design-system-versions", designSystemVersionsRouter);
router.use("/ds/component-states", componentStatesRouter);
router.use("/ds/components", componentsRouter);
router.use("/ds/design-system-components", designSystemComponentsRouter);
router.use("/ds/variations", variationsRouter);
router.use("/ds/properties", propertiesRouter);
router.use("/ds/property-platform-params", propertyPlatformParamsRouter);
router.use("/ds/variation-platform-param-adjustments", variationPlatformParamAdjustmentsRouter);
router.use("/ds/invariant-platform-param-adjustments", invariantPlatformParamAdjustmentsRouter);
router.use("/ds/property-variations", propertyVariationsRouter);
router.use("/ds/appearances", appearancesRouter);
router.use("/ds/styles", stylesRouter);
router.use("/ds/tokens", tokensRouter);
router.use("/ds/tenants", tenantsRouter);
router.use("/ds/token-values", tokenValuesRouter);
router.use("/ds/variation-property-values", variationPropertyValuesRouter);
router.use("/ds/invariant-property-values", invariantPropertyValuesRouter);
router.use("/ds/documentation-pages", documentationPagesRouter);
router.use("/ds/component-deps", componentDepsRouter);
router.use("/ds/component-reuse-configs", componentReuseConfigsRouter);
router.use("/ds/style-combinations", styleCombinationsRouter);
router.use("/ds/style-combination-members", styleCombinationMembersRouter);
router.use("/ds/design-system-changes", designSystemChangesRouter);
router.use("/ds/saved-queries", savedQueriesRouter);
router.use("/ds/palette", paletteRouter);
router.use("/ds/legacy/design-systems", legacyRouter);
router.use("/ds/component-config", componentConfigRouter);

// Misc utility routes
router.use("/admin/tables", tablesRouter);
router.use("/admin/queries", queriesRouter);
router.use("/admin/nl-query", nlQueryRouter);
router.use("/admin/schema", schemaRouter);

export default router;
