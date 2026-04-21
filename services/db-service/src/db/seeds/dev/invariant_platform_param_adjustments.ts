import * as schema from '../../schema';

export async function seedInvariantPlatformParamAdjustments(
  db: any,
  ctx: {
    ipvRows: any[];
    properties: {
      findParam: (propertyId: string, platform: string, name: string) => any;
      btn_focusColor: any;
    };
  },
) {
  const { ipvRows } = ctx;
  const { findParam, btn_focusColor } = ctx.properties;

  const values: any[] = [];

  // ── Button focusColor (SDDS) — web template adjustment ─────────────────
  const focusColorIpv = ipvRows.find((r: any) =>
    r.propertyId === btn_focusColor.id && r.state === null,
  );
  if (focusColorIpv) {
    values.push({
      ipvId: focusColorIpv.id,
      platformParamId: findParam(btn_focusColor.id, 'web', 'buttonFocusColor').id,
      value: null,
      template: 'var(--plasma-#{value})',
    });
  }

  if (values.length > 0) {
    const rows = await db
      .insert(schema.invariantPlatformParamAdjustments)
      .values(values)
      .returning();
    console.log(`  invariant_platform_param_adjustments: ${rows.length} rows`);
    return rows;
  }

  console.log('  invariant_platform_param_adjustments: 0 rows');
  return [];
}
