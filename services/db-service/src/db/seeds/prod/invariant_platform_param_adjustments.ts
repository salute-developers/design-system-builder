import * as schema from '../../schema';

export async function seedInvariantPlatformParamAdjustments(
  db: any,
  ctx: {
    ipvRows: any[];
    properties: Record<string, any>;
  },
) {
  // No invariant platform param adjustments in prod data currently
  console.log('  invariant_platform_param_adjustments: 0 rows');
  return [];
}
