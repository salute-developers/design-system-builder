/**
 * Импорт токенов темы из репозитория theme-converter в БД: дизайн-система, tenant, токены и их
 * значения по платформам и режимам. Читает распакованную тему (`meta.json` и
 * `<platform>/<platform>_<type>.json`), то же самое, что `dsbuilder theme fetch` кладёт на диск.
 *
 * Usage:
 *   npx tsx src/db/import-theme.ts --dir=<распакованная тема> [--library=sdds_serv] [--tenant=<имя>]
 *
 * Модель: у токена нет режима в имени (`text.default.primary`), а значение хранится по
 * (tenant, platform, mode). В файлах темы режим — префикс `light.` / `dark.` у ключа. Значение
 * цвета вида `[general.amber.300]` (с необязательной непрозрачностью `[0.56]`) — ссылка на палитру,
 * она пишется как `palette_id` (палитра должна быть засеяна: `seed-prod`).
 *
 * Повторный запуск идемпотентен: дизайн-система, tenant и токены обновляются по имени, значения
 * tenant пересоздаются целиком.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { db, client } from './index';
import * as schema from './schema';

const arg = (name: string) =>
    process.argv
        .find((a) => a.startsWith(`--${name}=`))
        ?.slice(name.length + 3)
        .replace(/^["']|["']$/g, '');

const dir = arg('dir');
const library = arg('library') ?? 'sdds_serv';
const tenantName = arg('tenant') ?? library;

if (!dir) {
    console.error('Usage: npx tsx src/db/import-theme.ts --dir=<распакованная тема> [--library=sdds_serv] [--tenant=<имя>]');
    process.exit(2);
}

const PLATFORMS = ['web', 'ios', 'android'] as const;
const TYPES = ['color', 'gradient', 'typography', 'fontFamily', 'spacing', 'shape', 'shadow'] as const;
const BATCH_SIZE = 500;
const PALETTE_REF = /^\[(\w+)\.(\w+)\.(\d+)\](?:\[([\d.]+)\])?$/;

type Mode = 'light' | 'dark';
type Meta = { tokens: { type: string; name: string; displayName?: string; description?: string; enabled?: boolean }[] };

const splitMode = (key: string): { mode: Mode | null; name: string } => {
    const m = key.match(/^(light|dark)\.(.+)$/);
    return m ? { mode: m[1] as Mode, name: m[2] } : { mode: null, name: key };
};

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;

async function main() {
    const meta = readJson<Meta>(path.join(dir!, 'meta.json'));

    const [designSystem] = await db
        .insert(schema.designSystems)
        .values({ name: library, projectName: library, description: `Импортировано из theme-converter (${library})` })
        .onConflictDoUpdate({ target: schema.designSystems.name, set: { updatedAt: new Date() } })
        .returning();

    const [tenant] = await db
        .insert(schema.tenants)
        .values({ designSystemId: designSystem.id, name: tenantName, colorConfig: {} })
        .onConflictDoUpdate({
            target: [schema.tenants.designSystemId, schema.tenants.name],
            set: { updatedAt: new Date() },
        })
        .returning();
    console.log(`design system ${library} (${designSystem.id}), tenant ${tenantName} (${tenant.id})`);

    // Токены: имя без режима, тип/описание берутся из meta.json.
    const tokenDefs = new Map<string, { type: string; displayName?: string; description?: string; enabled: boolean }>();
    for (const t of meta.tokens) {
        const { name } = splitMode(t.name);
        if (!tokenDefs.has(name)) {
            tokenDefs.set(name, { type: t.type, displayName: t.displayName, description: t.description, enabled: t.enabled ?? true });
        }
    }
    const tokenRows = [...tokenDefs].map(([name, d]) => ({
        designSystemId: designSystem.id,
        name,
        type: d.type as any,
        displayName: d.displayName,
        description: d.description,
        enabled: d.enabled,
    }));
    for (let i = 0; i < tokenRows.length; i += BATCH_SIZE) {
        await db
            .insert(schema.tokens)
            .values(tokenRows.slice(i, i + BATCH_SIZE))
            .onConflictDoNothing();
    }
    const tokenIds = new Map<string, string>();
    for (const r of await db.select().from(schema.tokens).where(eq(schema.tokens.designSystemId, designSystem.id))) {
        tokenIds.set(r.name, r.id);
    }
    console.log(`tokens: ${tokenIds.size}`);

    const paletteIds = new Map<string, string>();
    const resolvePalette = async (type: string, shade: string, saturation: string) => {
        const key = `${type}.${shade}.${saturation}`;
        if (!paletteIds.has(key)) {
            const [row] = await db
                .select({ id: schema.palette.id })
                .from(schema.palette)
                .where(
                    and(
                        eq(schema.palette.type, type as 'general' | 'additional'),
                        eq(schema.palette.shade, shade),
                        eq(schema.palette.saturation, Number(saturation)),
                    ),
                )
                .limit(1);
            if (!row) throw new Error(`Нет в палитре: [${key}] — засейте палитру (seed-prod)`);
            paletteIds.set(key, row.id);
        }
        return paletteIds.get(key)!;
    };

    await db.delete(schema.tokenValues).where(eq(schema.tokenValues.tenantId, tenant.id));

    let total = 0;
    for (const platform of PLATFORMS) {
        for (const type of TYPES) {
            const file = path.join(dir!, platform, `${platform}_${type}.json`);
            if (!fs.existsSync(file)) continue;
            const rows: any[] = [];
            for (const [key, raw] of Object.entries(readJson<Record<string, unknown>>(file))) {
                const { mode, name } = splitMode(key);
                const tokenId = tokenIds.get(name);
                if (!tokenId) continue;
                const row: any = { tokenId, tenantId: tenant.id, platform, mode, paletteId: null };
                const ref = typeof raw === 'string' ? raw.match(PALETTE_REF) : null;
                if (ref) {
                    row.paletteId = await resolvePalette(ref[1], ref[2], ref[3]);
                    row.value = ref[4] !== undefined ? [ref[4]] : null;
                } else {
                    row.value = Array.isArray(raw) ? raw : [raw];
                }
                rows.push(row);
            }
            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                await db.insert(schema.tokenValues).values(rows.slice(i, i + BATCH_SIZE));
            }
            total += rows.length;
            console.log(`  ${platform}/${type}: ${rows.length}`);
        }
    }
    console.log(`token_values: ${total}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => client.end());
