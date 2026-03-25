import * as schema from '../../schema';
import generalJson from '../data/general.json';
import additionalJson from '../data/additional.json';

type PaletteJson = Record<string, Record<string, string>>;

function buildRows(data: PaletteJson, type: 'general' | 'additional') {
  const rows: { type: 'general' | 'additional'; shade: string; saturation: number; value: string }[] = [];

  for (const [shade, saturations] of Object.entries(data)) {
    for (const [sat, value] of Object.entries(saturations)) {
      rows.push({ type, shade, saturation: Number(sat), value });
    }
  }

  return rows;
}

export async function seedPalette(db: any) {
  const rows = [
    ...buildRows(generalJson as PaletteJson, 'general'),
    ...buildRows(additionalJson as PaletteJson, 'additional'),
  ];

  await db.insert(schema.palette).values(rows);

  const generalCount = Object.keys(generalJson).length;
  const additionalCount = Object.keys(additionalJson).length;

  console.log(`  palette: ${rows.length} rows (${generalCount} general shades, ${additionalCount} additional shades)`);
}
