import { Router } from "express";
import { spec } from "../openapi/spec";
import usersRouter from "./api/users";
import designSystemsRouter from "./api/design-systems";
import designSystemVersionsRouter from "./api/design-system-versions";
import componentsRouter from "./api/components";
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
import designSystemUsersRouter from "./api/design-system-users";
import designSystemChangesRouter from "./api/design-system-changes";
import savedQueriesRouter from "./api/saved-queries";
import paletteRouter from "./api/palette";
import legacyRouter from "./api/legacy";

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
router.use("/users", usersRouter);
router.use("/design-systems", designSystemsRouter);
router.use("/design-system-versions", designSystemVersionsRouter);
router.use("/components", componentsRouter);
router.use("/design-system-components", designSystemComponentsRouter);
router.use("/variations", variationsRouter);
router.use("/properties", propertiesRouter);
router.use("/property-platform-params", propertyPlatformParamsRouter);
router.use("/variation-platform-param-adjustments", variationPlatformParamAdjustmentsRouter);
router.use("/invariant-platform-param-adjustments", invariantPlatformParamAdjustmentsRouter);
router.use("/property-variations", propertyVariationsRouter);
router.use("/appearances", appearancesRouter);
router.use("/styles", stylesRouter);
router.use("/tokens", tokensRouter);
router.use("/tenants", tenantsRouter);
router.use("/token-values", tokenValuesRouter);
router.use("/variation-property-values", variationPropertyValuesRouter);
router.use("/invariant-property-values", invariantPropertyValuesRouter);
router.use("/documentation-pages", documentationPagesRouter);
router.use("/component-deps", componentDepsRouter);
router.use("/component-reuse-configs", componentReuseConfigsRouter);
router.use("/style-combinations", styleCombinationsRouter);
router.use("/style-combination-members", styleCombinationMembersRouter);
router.use("/design-system-users", designSystemUsersRouter);
router.use("/design-system-changes", designSystemChangesRouter);
router.use("/saved-queries", savedQueriesRouter);
router.use("/palette", paletteRouter);
router.use("/legacy/design-systems", legacyRouter);

// Misc utility routes
router.use("/tables", tablesRouter);
router.use("/queries", queriesRouter);
router.use("/nl-query", nlQueryRouter);
router.use("/schema", schemaRouter);

export default router;
