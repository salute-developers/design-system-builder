import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "../schema";
import { importComponents } from "../import/componentImport";
import { buildWebAdapter } from "./webAdapter";
import { withRollback, type TestTx } from "../../test/database";
import { configOf, seedGlobalLayer, type Fixture } from "../../test/fixtures";

/** Данные web-генерации строятся по состоянию, которое кладёт импорт, как и в тестах выгрузки. */

const importConfig = async (tx: TestTx, fixture: Fixture, invariants: Record<string, unknown>) => {
  const report = await importComponents(tx, fixture.designSystemId, [
    configOf({ rootVariationId: null, colorSchemeVariationId: null, invariants, defaults: [], variations: [] } as never),
  ]);
  expect(report.rejected).toEqual([]);
};

describe("buildWebAdapter", () => {
    /** Заводит web-параметр свойства и поправку на строку инварианта. */
    const adjustInvariant = async (
      tx: TestTx,
      fixture: Fixture,
      property: string,
      param: { platform: "web" | "xml"; name: string },
      adjustment: { value?: string; template?: string },
    ) => {
      const [prop] = await tx
        .select({ id: schema.properties.id })
        .from(schema.properties)
        .where(eq(schema.properties.name, property));
      const [ppp] = await tx
        .insert(schema.propertyPlatformParams)
        .values({ propertyId: prop.id, platform: param.platform, name: param.name })
        .returning();
      const [ipv] = await tx
        .select({ id: schema.invariantPropertyValues.id })
        .from(schema.invariantPropertyValues)
        .where(eq(schema.invariantPropertyValues.propertyId, prop.id));
      await tx.insert(schema.invariantPlatformParamAdjustments).values({
        ipvId: ipv.id,
        platformParamId: ppp.id,
        value: adjustment.value ?? null,
        template: adjustment.template ?? null,
      });
    };

    it("отдаёт шаблоны web-параметров по конфигурации", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "padding", type: "dimension" }]);
        await importConfig(tx, fixture, { padding: { type: "dimension", value: 8 } });

        await adjustInvariant(tx, fixture, "padding", { platform: "web", name: "testButtonPadding" }, { template: "0 $1" });
        // Шаблон другой платформы в web-маппинг не попадает.
        await adjustInvariant(tx, fixture, "padding", { platform: "xml", name: "paddings" }, { template: "$1dp" });

        const adapter = await buildWebAdapter(tx, fixture.designSystemId);
        // Имя и описание — из базы, шаблоны — по стилю, пустые поля не пишутся.
        expect(adapter).toEqual([
          {
            componentName: "test-button",
            name: "TestButton",
            description: "fixture",
            styles: { default: { templates: { padding: { testButtonPadding: "0 $1" } } } },
          },
        ]);
      });
    });

    it("отдаёт compose-связи только между компонентами пакета", async () => {
      await withRollback(async (tx) => {
        const fixture = await seedGlobalLayer(tx, [{ name: "background", type: "color" }]);
        await importConfig(tx, fixture, {});

        const [item] = await tx.insert(schema.components).values({ name: "TestItem" }).returning();
        const [absent] = await tx.insert(schema.components).values({ name: "TestAbsent" }).returning();
        await tx.insert(schema.appearances).values({
          designSystemId: fixture.designSystemId,
          componentId: item.id,
          name: "default",
        });
        await tx.insert(schema.componentDeps).values([
          { parentId: fixture.componentId, childId: item.id, type: "compose", order: 0 },
          { parentId: fixture.componentId, childId: absent.id, type: "compose", order: 1 },
          { parentId: item.id, childId: fixture.componentId, type: "reuse", order: 0 },
        ]);

        const adapter = await buildWebAdapter(tx, fixture.designSystemId);
        // Ребёнка без конфигурации в пакете нет, reuse генератору не нужен.
        expect(adapter.map((entry) => entry.componentName)).toEqual(["test-button", "test-item"]);
        expect(adapter[0].compose).toEqual(["test-item"]);
        expect(adapter[1]).toEqual({ componentName: "test-item", name: "TestItem" });
      });
    });
});
