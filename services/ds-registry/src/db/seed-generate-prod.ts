/**
 * Generates prod seed additions for a component from the current database state.
 *
 * Usage:
 *   npx tsx src/db/seed-generate-prod.ts --component="Counter"
 *
 * The script:
 * 1. Creates a component seed file (seeds/prod/components/<name>.ts) with onConflictDoUpdate
 * 2. Updates components/index.ts with the export
 * 3. Patches all shared seed files (variations.ts, properties.ts, etc.)
 * 4. Patches seed-prod.ts with the import, components object, and keyMap
 */

import { db, client } from './index';
import * as schema from './schema';
import { eq, and, inArray } from 'drizzle-orm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

// ─── CLI args ────────────────────────────────────────────────────────────────

function getComponentName(): string {
    const arg = process.argv.find((a) => a.startsWith('--component='));

    if (!arg) {
        console.error('Usage: npx tsx src/db/seed-generate-prod.ts --component="Counter"');
        process.exit(1);
    }

    return arg.split('=')[1].replace(/["']/g, '');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toVarName(name: string): string {
    return name.charAt(0).toLowerCase() + name.slice(1);
}

function toPropPrefix(name: string): string {
    return toVarName(name).slice(0, 3);
}

function toVarKey(compVar: string, variationName: string): string {
    return compVar + variationName.charAt(0).toUpperCase() + variationName.slice(1);
}

function esc(s: string | null | undefined): string {
    if (s === null || s === undefined) return "''";
    return `'${s.replace(/'/g, "\\'")}'`;
}

/**
 * Insert `addition` before the first match of `regex` in `content`.
 * Throws if no match found.
 */
function insertBeforeRegex(content: string, regex: RegExp, addition: string, label: string): string {
    const match = regex.exec(content);
    if (!match) throw new Error(`Anchor not found for: ${label}`);
    return content.slice(0, match.index) + addition + content.slice(match.index);
}

const changedFiles: string[] = [];

function patchFile(filePath: string, patcher: (content: string) => string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const patched = patcher(content);
    if (patched !== content) {
        fs.writeFileSync(filePath, patched);
        changedFiles.push(filePath);
        console.log(`  Patched: ${path.basename(filePath)}`);
    } else {
        console.log(`  Skipped (already patched): ${path.basename(filePath)}`);
    }
}

function formatFiles(files: string[]) {
    if (files.length === 0) return;
    console.log('\nFormatting with prettier...');
    const fileList = files.map((f) => `"${f}"`).join(' ');
    execSync(`npx prettier --write ${fileList}`, {
        cwd: path.resolve(__dirname, '..', '..'),
        stdio: 'inherit',
    });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const componentName = getComponentName();
    const varName = toVarName(componentName);
    const prefix = toPropPrefix(componentName);
    const dsPrefix = 'base';

    console.log(`Generating prod seed for: ${componentName}\n`);

    // ── Load data from DB ──────────────────────────────────────────────────────

    const [component] = await db.select().from(schema.components).where(eq(schema.components.name, componentName));
    if (!component) {
        console.error(`Component "${componentName}" not found.`);
        process.exit(1);
    }
    console.log(`  Component: ${component.name} (${component.id})`);

    const variations = await db.select().from(schema.variations).where(eq(schema.variations.componentId, component.id));
    console.log(`  Variations: ${variations.length}`);

    const properties = await db.select().from(schema.properties).where(eq(schema.properties.componentId, component.id));
    console.log(`  Properties: ${properties.length}`);

    const propertyIds = properties.map((p) => p.id);
    const variationIds = variations.map((v) => v.id);

    let platformParams: any[] = [];
    if (propertyIds.length > 0) {
        platformParams = await db
            .select()
            .from(schema.propertyPlatformParams)
            .where(inArray(schema.propertyPlatformParams.propertyId, propertyIds));
    }

    let propertyVariations: any[] = [];
    if (variationIds.length > 0 && propertyIds.length > 0) {
        propertyVariations = await db
            .select()
            .from(schema.propertyVariations)
            .where(inArray(schema.propertyVariations.variationId, variationIds));
    }

    const appearances = await db
        .select()
        .from(schema.appearances)
        .where(eq(schema.appearances.componentId, component.id));

    let styles: any[] = [];
    if (variationIds.length > 0) {
        styles = await db.select().from(schema.styles).where(inArray(schema.styles.variationId, variationIds));
    }

    const styleIds = styles.map((s) => s.id);
    let vpvRows: any[] = [];
    if (styleIds.length > 0) {
        vpvRows = await db
            .select()
            .from(schema.variationPropertyValues)
            .where(inArray(schema.variationPropertyValues.styleId, styleIds));
    }

    let ipvRows: any[] = [];
    if (propertyIds.length > 0) {
        ipvRows = await db
            .select()
            .from(schema.invariantPropertyValues)
            .where(
                and(
                    eq(schema.invariantPropertyValues.componentId, component.id),
                    inArray(schema.invariantPropertyValues.propertyId, propertyIds),
                ),
            );
    }

    const tokenIdSet = new Set<string>();
    for (const row of [...vpvRows, ...ipvRows]) {
        if (row.tokenId) tokenIdSet.add(row.tokenId);
    }
    let tokens: any[] = [];
    if (tokenIdSet.size > 0) {
        tokens = await db
            .select()
            .from(schema.tokens)
            .where(inArray(schema.tokens.id, [...tokenIdSet]));
    }
    const tokenById = new Map(tokens.map((t) => [t.id, t]));

    // ── Lookup maps ──
    const propById = new Map(properties.map((p) => [p.id, p]));
    const variationById = new Map(variations.map((v) => [v.id, v]));
    const styleById = new Map(styles.map((s) => [s.id, s]));
    const appearanceById = new Map(appearances.map((a) => [a.id, a]));

    const seedsDir = path.join(__dirname, 'seeds', 'prod');

    console.log('\nPatching seed files...\n');

    // ── 1. Create component seed file (with onConflictDoUpdate) ───────────────

    const componentFilePath = path.join(seedsDir, 'components', `${varName}.ts`);
    fs.writeFileSync(
        componentFilePath,
        `import { sql } from 'drizzle-orm';
import * as schema from '../../../schema';

export async function seed${componentName}Component(db: any) {
  const [${varName}] = await db
    .insert(schema.components)
    .values([
      { name: ${esc(component.name)}, description: ${esc(component.description)} },
    ])
    .onConflictDoUpdate({
      target: schema.components.name,
      set: { description: sql\`excluded.description\` },
    })
    .returning();

  console.log(\`  components: ${componentName}(\${${varName}.id})\`);
  return ${varName};
}
`,
    );
    changedFiles.push(componentFilePath);
    console.log(`  Created: components/${varName}.ts`);

    // ── 2. Patch components/index.ts ───────────────────────────────────────────

    const exportLine = `export { seed${componentName}Component } from './${varName}';\n`;
    patchFile(path.join(seedsDir, 'components', 'index.ts'), (c) =>
        c.includes(`seed${componentName}Component`) ? c : c.trimEnd() + '\n' + exportLine,
    );

    // ── 3. Patch seed-prod.ts ──────────────────────────────────────────────────

    patchFile(path.join(__dirname, 'seed-prod.ts'), (c) => {
        if (c.includes(`seed${componentName}Component`)) return c;

        // Add to the components import (handles both single-line and multi-line)
        c = c.replace(
            /(\n)(} from '\.\/seeds\/prod\/components')/,
            `\n    seed${componentName}Component,\n$2`,
        );

        // Add to components object (before closing brace + "// ── 3. Determine")
        c = c.replace(
            /(\n\s*};\n\n\s*\/\/ ── 3\. Determine)/,
            `\n        ${varName}: await seed${componentName}Component(db),$1`,
        );

        // Add to keyMap (before closing brace + "let componentIdsToReseed")
        c = c.replace(
            /(\n\s*};\n\n\s*let componentIdsToReseed)/,
            `\n        ${componentName}: '${varName}',$1`,
        );

        return c;
    });

    // ── 4. Patch design_system_components.ts ───────────────────────────────────

    patchFile(path.join(seedsDir, 'design_system_components.ts'), (c) => {
        if (c.includes(`${varName}.id`)) return c;

        c = c.replace(/(components: \{[^}]*)(})/, `$1; ${varName}: any $2`);
        c = c.replace(/(const \{[^}]*)(} = ctx\.components)/, `$1, ${varName} $2`);

        // Add before ]).onConflictDoNothing (indent-agnostic)
        c = insertBeforeRegex(
            c,
            /\n\s*\]\)\n\s*\.onConflictDoNothing\(\)/,
            `\n      { designSystemId: base.id, componentId: ${varName}.id },`,
            'design_system_components values',
        );

        return c;
    });

    // ── 5. Patch appearances.ts ────────────────────────────────────────────────

    patchFile(path.join(seedsDir, 'appearances.ts'), (c) => {
        if (c.includes(`${varName}.id`)) return c;

        c = c.replace(/(components: \{[^}]*)(})/, `$1; ${varName}: any $2`);
        c = c.replace(/(const \{[^}]*)(} = ctx\.components)/, `$1, ${varName} $2`);

        // Add to values array (before closing ];)
        const appValues = appearances
            .map((a) => `        { designSystemId: base.id, componentId: ${varName}.id, name: ${esc(a.name)} },`)
            .join('\n');
        c = insertBeforeRegex(
            c,
            /\n\s*\];\n\s*\n\s*await db\.insert\(schema\.appearances\)/,
            `\n${appValues}`,
            'appearances values',
        );

        // Add componentId to the componentIds array
        c = c.replace(
            /(const componentIds = \[[^\]]*)(])/,
            `$1, ${varName}.id$2`,
        );

        // Add to return object (before closing }; + console.log appearances)
        const appEntries = appearances
            .map((a) => `        ${dsPrefix}_${prefix}_${a.name}: findByComp(${varName}.id),`)
            .join('\n');
        c = insertBeforeRegex(
            c,
            /\n\s*};\n\s*\n\s*console\.log\(`\s*appearances/,
            `\n${appEntries}`,
            'appearances return object',
        );

        return c;
    });

    // ── 6. Patch variations.ts ─────────────────────────────────────────────────

    patchFile(path.join(seedsDir, 'variations.ts'), (c) => {
        if (c.includes(`${varName}.id`)) return c;

        c = c.replace(/(components: \{[^}]*)(})/, `$1; ${varName}: any $2`);
        c = c.replace(/(const \{[^}]*)(} = ctx\.components)/, `$1, ${varName} $2`);

        // Add to values array (before ]).onConflictDoUpdate)
        const varLines = variations
            .map(
                (v) =>
                    `            { componentId: ${varName}.id, name: ${esc(v.name)}, description: ${esc(v.description)} },`,
            )
            .join('\n');
        c = insertBeforeRegex(
            c,
            /\n\s*\]\)\n\s*\.onConflictDoUpdate\(/,
            `\n            // ${componentName}\n${varLines}`,
            'variations values',
        );

        // Add to return object
        const varEntries = variations
            .map((v) => `        ${toVarKey(varName, v.name)}: find(${varName}.id, ${esc(v.name)}),`)
            .join('\n');
        c = insertBeforeRegex(
            c,
            /\n\s*};\n\s*\n\s*console\.log\(`\s*variations/,
            `\n        // ${componentName}\n${varEntries}`,
            'variations return object',
        );

        return c;
    });

    // ── 7. Patch properties.ts ─────────────────────────────────────────────────

    patchFile(path.join(seedsDir, 'properties.ts'), (c) => {
        if (c.includes(`find${componentName}`)) return c;

        c = c.replace(/(components: \{[^}]*)(})/, `$1; ${varName}: any $2`);
        c = c.replace(/(const \{[^}]*)(} = ctx\.components)/, `$1, ${varName} $2`);

        // Add properties to values array (before ]).onConflictDoUpdate)
        const propLines = properties
            .map(
                (p) =>
                    `      { componentId: ${varName}.id, name: ${esc(p.name)}, type: ${esc(p.type)} as const, defaultValue: ${esc(p.defaultValue)}, description: ${esc(p.description)} },`,
            )
            .join('\n');
        c = insertBeforeRegex(
            c,
            /\n\s*\]\)\n\s*\.onConflictDoUpdate\(\{\s*\n\s*target: \[schema\.properties/,
            `\n\n      // ── ${componentName} ──────────────────────────────────────────────────────────\n${propLines}`,
            'properties values',
        );

        // Add find function and platform params
        const platformParamsByPropId = new Map<string, any[]>();
        for (const pp of platformParams) {
            if (!platformParamsByPropId.has(pp.propertyId)) platformParamsByPropId.set(pp.propertyId, []);
            platformParamsByPropId.get(pp.propertyId)!.push(pp);
        }

        const ppLines: string[] = [
            `\n  // ${componentName}`,
            `  const find${componentName} = (name: string) => rows.find((r: any) => r.componentId === ${varName}.id && r.name === name)!;`,
        ];
        for (const prop of properties) {
            const params = platformParamsByPropId.get(prop.id) || [];
            if (params.length === 0) continue;
            const grouped: Record<string, string[]> = {};
            for (const pp of params) {
                if (!grouped[pp.platform]) grouped[pp.platform] = [];
                grouped[pp.platform].push(pp.name);
            }
            const obj = Object.entries(grouped)
                .map(([plat, names]) => `${plat}: [${names.map(esc).join(', ')}]`)
                .join(', ');
            ppLines.push(`  addPlatformParams(find${componentName}(${esc(prop.name)}).id, { ${obj} });`);
        }

        c = insertBeforeRegex(c, /\n\s*let platformParams/, ppLines.join('\n'), 'properties platform params');

        // Add to return object
        const propEntries = properties
            .map((p) => `    ${prefix}_${p.name}: find${componentName}(${esc(p.name)}),`)
            .join('\n');
        c = insertBeforeRegex(
            c,
            /\n\s*};\n\s*\n\s*console\.log\(`\s*properties/,
            `\n    // ${componentName}\n${propEntries}`,
            'properties return object',
        );

        return c;
    });

    // ── 8. Patch property_variations.ts ────────────────────────────────────────

    patchFile(path.join(seedsDir, 'property_variations.ts'), (c) => {
        if (c.includes(`// ── ${componentName}`)) return c;

        const pvLines = propertyVariations
            .map((pv) => {
                const prop = propById.get(pv.propertyId);
                const variation = variationById.get(pv.variationId);
                if (!prop || !variation) return null;
                return `      { propertyId: p.${prefix}_${prop.name}.id, variationId: v.${toVarKey(varName, variation.name)}.id },`;
            })
            .filter(Boolean)
            .join('\n');

        c = insertBeforeRegex(
            c,
            /\n\s*\]\)\n\s*\.onConflictDoNothing\(\)/,
            `\n\n      // ── ${componentName} ──────────────────────────────────────────────────────────\n${pvLines}`,
            'property_variations values',
        );

        return c;
    });

    // ── 9. Patch styles.ts ─────────────────────────────────────────────────────

    patchFile(path.join(seedsDir, 'styles.ts'), (c) => {
        if (c.includes(`// ── ${componentName}`)) return c;

        // Add to values array (before ]).onConflictDoUpdate)
        const styleLines = styles
            .map((s) => {
                const variation = variationById.get(s.variationId);
                if (!variation) return null;
                return `      { designSystemId: base.id, variationId: v.${toVarKey(varName, variation.name)}.id, name: ${esc(s.name)}, description: ${esc(s.description)}, isDefault: ${s.isDefault} },`;
            })
            .filter(Boolean)
            .join('\n');

        c = insertBeforeRegex(
            c,
            /\n\s*\]\)\n\s*\.onConflictDoUpdate\(\{\s*\n\s*target: \[schema\.styles/,
            `\n\n      // ── ${componentName} ──────────────────────────────────────────────────────────\n${styleLines}`,
            'styles values',
        );

        // Add to return object
        const styleEntries = styles
            .map((s) => {
                const variation = variationById.get(s.variationId);
                if (!variation) return null;
                return `    ${dsPrefix}_${prefix}_${variation.name}_${s.name}: find(v.${toVarKey(varName, variation.name)}.id, ${esc(s.name)}),`;
            })
            .filter(Boolean)
            .join('\n');

        c = insertBeforeRegex(
            c,
            /\n\s*};\n\s*\n\s*console\.log\(`\s*styles/,
            `\n    // ${componentName}\n${styleEntries}`,
            'styles return object',
        );

        return c;
    });

    // ── 10. Patch variation_property_values.ts ─────────────────────────────────

    patchFile(path.join(seedsDir, 'variation_property_values.ts'), (c) => {
        if (c.includes(`// ${componentName}`) && c.includes(`${prefix}App`)) return c;

        // Add appearance variable
        const appVarName = `${prefix}App`;
        if (appearances.length > 0 && !c.includes(`const ${appVarName}`)) {
            const appKey = `${dsPrefix}_${prefix}_${appearances[0].name}`;
            c = c.replace(
                'const rows: VpvRow[] = [',
                `const ${appVarName} = a.${appKey}.id;\n\n  const rows: VpvRow[] = [`,
            );
        }

        // Add VPV rows
        const vpvLines = vpvRows
            .map((row) => {
                const prop = propById.get(row.propertyId);
                const style = styleById.get(row.styleId);
                if (!prop || !style) return null;
                const variation = variationById.get(style.variationId);
                if (!variation) return null;

                const styleKey = `${dsPrefix}_${prefix}_${variation.name}_${style.name}`;
                const propKey = `${prefix}_${prop.name}`;
                let tokenRef: string;
                if (row.tokenId) {
                    const token = tokenById.get(row.tokenId);
                    tokenRef = token ? `tokenMap[${esc(token.name)}].id` : 'null';
                } else {
                    tokenRef = 'null';
                }
                const valueStr = row.value != null ? `, value: ${esc(row.value)}` : '';
                const stateStr = row.state ? `'${row.state}'` : 'null';

                return `    { propertyId: p.${propKey}.id, styleId: s.${styleKey}.id, appearanceId: ${appVarName}, tokenId: ${tokenRef}${valueStr}, state: ${stateStr} },`;
            })
            .filter(Boolean)
            .join('\n');

        c = insertBeforeRegex(
            c,
            /\n\s*\];\n\s*\n\s*await db\.insert\(schema\.variationPropertyValues\)/,
            `\n\n    // ══════════════════════════════════════════════════════════════════════════\n    // ${componentName}\n    // ══════════════════════════════════════════════════════════════════════════\n\n${vpvLines}`,
            'variation_property_values rows',
        );

        return c;
    });

    // ── 11. Patch invariant_property_values.ts ─────────────────────────────────

    if (ipvRows.length > 0) {
        patchFile(path.join(seedsDir, 'invariant_property_values.ts'), (c) => {
            if (c.includes(`// ${componentName}`) && c.includes(`${prefix}_`)) return c;

            if (!c.includes(`${varName}: any`)) {
                c = c.replace(/(components: \{[^}]*)(})/, `$1; ${varName}: any $2`);
                c = c.replace(/(const \{[^}]*)(} = ctx\.components)/, `$1, ${varName} $2`);
            }

            const ipvLines = ipvRows
                .map((row) => {
                    const prop = propById.get(row.propertyId);
                    if (!prop) return null;
                    const appearance = appearanceById.get(row.appearanceId);
                    if (!appearance) return null;
                    const appKey = `${dsPrefix}_${prefix}_${appearance.name}`;
                    const propKey = `${prefix}_${prop.name}`;
                    let tokenPart = '';
                    if (row.tokenId) {
                        const token = tokenById.get(row.tokenId);
                        if (token) tokenPart = `tokenId: t[${esc(token.name)}].id, `;
                    }
                    const valuePart = row.value != null ? `value: ${esc(row.value)}, ` : '';
                    const stateStr = row.state ? `'${row.state}'` : 'null';
                    return `      { propertyId: p.${propKey}.id, designSystemId: base.id, componentId: ${varName}.id, appearanceId: a.${appKey}.id, ${tokenPart}${valuePart}state: ${stateStr} },`;
                })
                .filter(Boolean)
                .join('\n');

            c = insertBeforeRegex(
                c,
                /\n\s*\]\)\n\s*\.onConflictDoNothing\(\)/,
                `\n      // ${componentName}\n${ipvLines}`,
                'invariant_property_values values',
            );

            return c;
        });
    }

    formatFiles(changedFiles);

    console.log('\nDone! New seed data for', componentName, 'has been added to all prod seed files.');
    console.log(`Run 'npm run db:seed:prod' to apply.`);
}

main()
    .catch((err) => {
        console.error('Generation failed:', err);
        process.exit(1);
    })
    .finally(() => client.end());
