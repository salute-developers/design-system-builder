import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { eq, and } from "drizzle-orm";
import { allComponentsData } from "./all-components-data";

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ds_builder';

// Create the connection
const client = postgres(connectionString);
const db = drizzle(client, { schema });

// Extracted data from components
const extractedData = allComponentsData;

async function seedFromExtractedData(clearDatabase = false) {
  console.log("🌱 Starting database seed from extracted data...");

  if (clearDatabase) {
    console.log("⚠️  WARNING: This will clear all existing data!");
    console.log("🧹 Clearing existing data...");
    await db.delete(schema.tokenValues);
    await db.delete(schema.tokenVariations);
    await db.delete(schema.variationValues);
    await db.delete(schema.propsAPI);
    await db.delete(schema.tokens);
    await db.delete(schema.variations);
    await db.delete(schema.designSystemComponents);
    await db.delete(schema.components);
    await db.delete(schema.designSystems);
  } else {
    console.log("ℹ️  Adding data to existing database (no clearing)");
  }

  try {
    // Insert Design Systems
    console.log("📊 Creating design systems...");
    const designSystemInserts = extractedData.designSystems.map((ds) => ({
      name: ds.name,
      description: ds.description,
      projectName: ds.projectName,
      grayTone: ds.grayTone,
      accentColor: ds.accentColor,
      lightStrokeSaturation: ds.lightStrokeSaturation,
      lightFillSaturation: ds.lightStrokeSaturation,
      darkStrokeSaturation: ds.darkStrokeSaturation,
      darkFillSaturation: ds.darkFillSaturation,
    }));
    const insertedDesignSystems = await db
      .insert(schema.designSystems)
      .values(designSystemInserts)
      .returning();
    console.log(`✅ Created ${insertedDesignSystems.length} design systems`);

    // Create ID mapping for design systems
    const designSystemIdMap = new Map();
    extractedData.designSystems.forEach((ds, index) => {
      designSystemIdMap.set(ds.id, insertedDesignSystems[index].id);
    });

    // Insert Components
    console.log("🔧 Creating components...");
    const componentInserts = extractedData.components.map((c) => ({
      name: c.name,
      description: c.description,
    }));
    const insertedComponents = await db
      .insert(schema.components)
      .values(componentInserts)
      .returning();
    console.log(`✅ Created ${insertedComponents.length} components`);

    // Create ID mapping for components
    const componentIdMap = new Map();
    extractedData.components.forEach((comp, index) => {
      componentIdMap.set(comp.id, insertedComponents[index].id);
    });

    // Insert Variations
    console.log("🎨 Creating variations...");
    const variationInserts = extractedData.variations.map((variation) => ({
      name: variation.name,
      description: variation.description,
      componentId: componentIdMap.get(variation.componentId),
    }));
    const insertedVariations = await db
      .insert(schema.variations)
      .values(variationInserts)
      .returning();
    console.log(`✅ Created ${insertedVariations.length} variations`);

    // Create ID mapping for variations
    const variationIdMap = new Map();
    extractedData.variations.forEach((variation, index) => {
      variationIdMap.set(variation.id, insertedVariations[index].id);
    });

    // Insert Tokens
    console.log("🎯 Creating tokens...");
    const tokenInserts = extractedData.tokens.map((token) => ({
      name: token.name,
      description: token.description,
      type: token.type,
      defaultValue: token.defaultValue,
      componentId: componentIdMap.get(token.componentId),
      xmlParam: token.xmlParam,
      composeParam: token.composeParam,
      iosParam: token.iosParam,
      webParam: token.webParam,
    }));
    const insertedTokens = await db
      .insert(schema.tokens)
      .values(tokenInserts)
      .returning();
    console.log(`✅ Created ${insertedTokens.length} tokens`);

    // Create ID mapping for tokens
    const tokenIdMap = new Map();
    extractedData.tokens.forEach((token, index) => {
      tokenIdMap.set(token.id, insertedTokens[index].id);
    });

    // Insert Token-Variation Assignments
    console.log("🔗 Creating token-variation assignments...");
    const tokenVariationInserts = extractedData.tokenVariations.map((tv) => ({
      tokenId: tokenIdMap.get(tv.tokenId),
      variationId: variationIdMap.get(tv.variationId),
    }));
    await db.insert(schema.tokenVariations).values(tokenVariationInserts);
    console.log(
      `✅ Created ${tokenVariationInserts.length} token-variation assignments`
    );

    // Insert Design System Components
    console.log("🔗 Creating design system-component relationships...");
    const designSystemComponentInserts =
      extractedData.designSystemComponents.map((dsc) => ({
        designSystemId: designSystemIdMap.get(dsc.designSystemId),
        componentId: componentIdMap.get(dsc.componentId),
      }));
    await db
      .insert(schema.designSystemComponents)
      .values(designSystemComponentInserts);
    console.log(
      `✅ Created ${designSystemComponentInserts.length} design system-component relationships`
    );

    // Insert Props API
    console.log("⚙️ Creating props API...");
    const propsAPIInserts = extractedData.propsAPI.map((prop) => ({
      name: prop.name,
      value: prop.defaultValue || "false",
      componentId: componentIdMap.get(prop.componentId),
    }));
    await db.insert(schema.propsAPI).values(propsAPIInserts);
    console.log(`✅ Created ${propsAPIInserts.length} props API entries`);

    // Insert Variation Values
    console.log("📝 Creating variation values...");
    const variationValueInserts = extractedData.variationValues.map((vv) => {
      // derive componentId from the parent variation of this variation value
      const parentVariation = extractedData.variations.find(
        (v) => v.id === vv.variationId
      );
      const parentComponentId = parentVariation
        ? parentVariation.componentId
        : undefined;
      const isDefault = (vv as any).isDefaultValue ? "true" : "false";

      return {
        designSystemId: designSystemIdMap.get(1),
        componentId:
          parentComponentId !== undefined
            ? componentIdMap.get(parentComponentId)
            : undefined,
        variationId: variationIdMap.get(vv.variationId),
        name: vv.value,
        description: vv.description,
        isDefaultValue: isDefault,
      };
    });
    const insertedVariationValues = await db
      .insert(schema.variationValues)
      .values(variationValueInserts)
      .returning();
    console.log(
      `✅ Created ${insertedVariationValues.length} variation values`
    );

    // Create ID mapping for variation values
    const variationValueIdMap = new Map();
    extractedData.variationValues.forEach((vv, index) => {
      variationValueIdMap.set(vv.id, insertedVariationValues[index].id);
    });

    // Insert Token Values (variation values)
    console.log("🎨 Creating token values for variation values...");
    // Build helper maps to ensure token values are inserted only for matching components
    const tokenIdToComponentId = new Map<number, number>();
    extractedData.tokens.forEach((t) =>
      tokenIdToComponentId.set(t.id, t.componentId)
    );

    const variationIdToComponentId = new Map<number, number>();
    extractedData.variations.forEach((v) =>
      variationIdToComponentId.set(v.id, v.componentId)
    );

    const variationValueIdToComponentId = new Map<number, number>();
    extractedData.variationValues.forEach((vv) => {
      const parentComponentId = variationIdToComponentId.get(vv.variationId);
      if (parentComponentId !== undefined)
        variationValueIdToComponentId.set(vv.id, parentComponentId);
    });

    const variationTokenValueInserts = extractedData.tokenValues
      .filter((tv) => tv.variationValueId)
      .filter((tv) => {
        const tokenComponentId = tokenIdToComponentId.get(tv.tokenId);
        const vvComponentId = tv.variationValueId
          ? variationValueIdToComponentId.get(tv.variationValueId)
          : undefined;
        return (
          tokenComponentId !== undefined &&
          vvComponentId !== undefined &&
          tokenComponentId === vvComponentId
        );
      })
      .map((tv) => ({
        variationValueId: variationValueIdMap.get(tv.variationValueId),
        tokenId: tokenIdMap.get(tv.tokenId),
        value: tv.value,
        states: (tv as any).states || null,
      }));
    await db.insert(schema.tokenValues).values(variationTokenValueInserts);
    console.log(
      `✅ Created ${variationTokenValueInserts.length} variation token values`
    );

    // Insert Invariant Token Values
    console.log("🔒 Creating invariant token values...");
    const invariantTokenValueInserts = extractedData.invariantTokenValues.map(
      (tv) => ({
        tokenId: tokenIdMap.get(tv.tokenId),
        value: tv.value,
        type: tv.type,
        componentId: componentIdMap.get(tv.componentId),
        designSystemId: designSystemIdMap.get(tv.designSystemId),
      })
    );
    await db.insert(schema.tokenValues).values(invariantTokenValueInserts);
    console.log(
      `✅ Created ${invariantTokenValueInserts.length} invariant token values`
    );

    console.log("\n✅ Seed from extracted data completed successfully!");
    console.log("📊 Summary:");
    console.log(`  • ${insertedDesignSystems.length} Design Systems`);
    console.log(`  • ${insertedComponents.length} Components`);
    console.log(`  • ${insertedVariations.length} Variations`);
    console.log(`  • ${insertedTokens.length} Tokens`);
    console.log(
      `  • ${tokenVariationInserts.length} Token-Variation Assignments`
    );
    console.log(
      `  • ${designSystemComponentInserts.length} Design System-Component Relationships`
    );
    console.log(`  • ${propsAPIInserts.length} Props API Entries`);
    console.log(`  • ${insertedVariationValues.length} Variation Values`);
    console.log(
      `  • ${variationTokenValueInserts.length} Variation Token Values`
    );
    console.log(
      `  • ${invariantTokenValueInserts.length} Invariant Token Values`
    );
  } catch (error) {
    console.error("❌ Error during seed:", error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the seed function
if (require.main === module) {
  const clearDatabase = process.argv.includes("--clear");

  async function runSeed() {
    if (clearDatabase) {
      console.log(
        "⚠️  WARNING: Running with --clear flag will delete all existing data!"
      );
      console.log("Press Ctrl+C to cancel, or wait 5 seconds to continue...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    await seedFromExtractedData(clearDatabase);
  }

  runSeed().catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
}

export { seedFromExtractedData };
