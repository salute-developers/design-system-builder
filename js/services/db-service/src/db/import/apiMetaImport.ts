import { and, eq, inArray } from "drizzle-orm";
import * as schema from "../schema";
import {
  aliasesOf,
  mergeAliases,
  type ApiMetaComponent,
  type ApiMetaImportRequest,
  type ManifestAlias,
} from "./apiMetaManifest";

type Tx = Parameters<Parameters<typeof import("../index").db.transaction>[0]>[0];

/** Размер пачки: вставка и выборка по `in` не должны упираться в лимит параметров запроса. */
const CHUNK_SIZE = 1000;

const COMPONENT_DESCRIPTION = "Imported from api-meta";

export interface ApiMetaRejection {
  component: string;
  property: string;
  reason: string;
}

export interface ApiMetaImportReport {
  createdComponents: number;
  createdProperties: number;
  createdStates: number;
  createdAliases: number;
  /** Свойства, которые уже были в базе с тем же типом. */
  unchangedProperties: number;
  /** Алиасы, ставшие устаревшими (в том числе созданные сразу устаревшими). */
  deprecatedMarked: number;
  /** Устаревшие алиасы, у которых изменилось сообщение. */
  deprecatedMessageChanged: number;
  /** Алиасы, с которых снята пометка: в мете её больше нет. */
  deprecatedCleared: number;
  /** Свойства, которые не удалось записать; остальной импорт от них не зависит. */
  rejected: ApiMetaRejection[];
  /**
   * Существующие свойства, чей тип в базе отличается от присланного.
   *
   * Тип не меняется: на тип опираются значения конфигураций, и импорт не вправе его переписывать.
   * Сравнение идёт только внутри платформы запроса.
   */
  typeMismatches: string[];
  /**
   * Справочно: что есть в базе для платформы запроса, но отсутствует в мете. Запись `Component`
   * — компонент платформы целиком, `Component.property` — свойство импортируемого компонента.
   * Ничего не удаляется и на результат не влияет.
   */
  absent: string[];
}

const chunked = <T>(items: T[], size = CHUNK_SIZE): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

interface MergedProperty {
  name: string;
  type: string;
  description?: string;
  aliases: ManifestAlias[];
}

interface MergedComponent {
  name: string;
  properties: MergedProperty[];
  states: string[];
}

/**
 * Сводит повторы одного компонента и одного свойства.
 *
 * Манифест строит CLI, и повторов он не даёт, но контракт не должен зависеть от того, что
 * клиент аккуратен: первое вхождение побеждает, противоречащий тип второго уходит в отказ, а
 * платформенные имена повтора с тем же типом добавляются к именам первого вхождения.
 */
const mergeComponents = (
  components: ApiMetaComponent[],
  rejected: ApiMetaRejection[],
): MergedComponent[] => {
  const byName = new Map<string, ApiMetaComponent["properties"]>();
  const statesByName = new Map<string, string[]>();
  for (const component of components) {
    byName.set(component.name, [...(byName.get(component.name) ?? []), ...component.properties]);
    statesByName.set(component.name, [...(statesByName.get(component.name) ?? []), ...component.states]);
  }

  return [...byName.entries()].map(([name, source]) => {
    const properties = new Map<string, MergedProperty>();
    for (const property of source) {
      const known = properties.get(property.name);
      if (!known) {
        properties.set(property.name, {
          name: property.name,
          type: property.type,
          description: property.description,
          aliases: aliasesOf(property),
        });
      } else if (known.type !== property.type) {
        rejected.push({
          component: name,
          property: property.name,
          reason: `duplicate property with a different type: ${known.type} and ${property.type}`,
        });
      } else {
        known.aliases = mergeAliases([...known.aliases, ...aliasesOf(property)]);
      }
    }
    return {
      name,
      properties: [...properties.values()],
      states: [...new Set(statesByName.get(name) ?? [])],
    };
  });
};

/**
 * Заводит компоненты платформы запроса, их свойства, состояния и платформенные имена из манифеста.
 *
 * Компонент идентифицируется парой `(name, platform)`: компоненты других платформ не читаются и
 * не меняются. Запись только добавляет: существующие строки не меняются и не удаляются. К
 * дизайн-системам компоненты не привязываются. Единственное, что импорт обновляет у существующих
 * строк, — статус устаревания алиаса: пометка ставится, сообщение меняется, пометка снимается.
 * Расхождение типа существующего свойства отчитывается, но не правится; неизвестный тип отклоняет
 * свойство, а не запрос.
 *
 * Тип проверяется по `propertyTypeEnum`: это единственный источник допустимых значений, и
 * неизвестный тип означает, что схему надо расширить миграцией, а не что импорт вправе
 * расширить её сам.
 */
export const importApiMeta = async (
  tx: Tx,
  request: Pick<ApiMetaImportRequest, "platform" | "components">,
): Promise<ApiMetaImportReport> => {
  const report: ApiMetaImportReport = {
    createdComponents: 0,
    createdProperties: 0,
    createdStates: 0,
    createdAliases: 0,
    unchangedProperties: 0,
    deprecatedMarked: 0,
    deprecatedMessageChanged: 0,
    deprecatedCleared: 0,
    rejected: [],
    typeMismatches: [],
    absent: [],
  };
  const supportedTypes = new Set<string>(schema.propertyTypeEnum.enumValues);
  const components = mergeComponents(request.components, report.rejected);
  const platformIs = eq(schema.components.platform, request.platform);

  // Компоненты платформы: недостающие создаются, существующие не трогаются.
  const names = components.map((component) => component.name);
  const componentIds = new Map<string, string>();
  for (const part of chunked(names)) {
    const rows = await tx
      .select({ id: schema.components.id, name: schema.components.name })
      .from(schema.components)
      .where(and(platformIs, inArray(schema.components.name, part)));
    for (const row of rows) componentIds.set(row.name, row.id);
  }

  const missing = names.filter((name) => !componentIds.has(name));
  for (const part of chunked(missing)) {
    const created = await tx
      .insert(schema.components)
      .values(part.map((name) => ({ name, platform: request.platform, description: COMPONENT_DESCRIPTION })))
      .onConflictDoNothing()
      .returning({ id: schema.components.id, name: schema.components.name });
    report.createdComponents += created.length;
    for (const row of created) componentIds.set(row.name, row.id);
  }

  // Строка, которую параллельный запрос успел завести между выборкой и вставкой,
  // возвращается `onConflictDoNothing` пустой: дочитываем её, чтобы не потерять компонент.
  const lost = names.filter((name) => !componentIds.has(name));
  for (const part of chunked(lost)) {
    const rows = await tx
      .select({ id: schema.components.id, name: schema.components.name })
      .from(schema.components)
      .where(and(platformIs, inArray(schema.components.name, part)));
    for (const row of rows) componentIds.set(row.name, row.id);
  }

  const idList = [...componentIds.values()];

  // Состояния, объявленные компонентом.
  const existingStates = new Set<string>();
  for (const part of chunked(idList)) {
    const rows = await tx
      .select({ componentId: schema.states.componentId, name: schema.states.name })
      .from(schema.states)
      .where(inArray(schema.states.componentId, part));
    for (const row of rows) existingStates.add(`${row.componentId}::${row.name}`);
  }
  const newStates: Array<{ componentId: string; name: string }> = [];
  for (const component of components) {
    const componentId = componentIds.get(component.name);
    if (!componentId) continue;
    for (const name of component.states) {
      if (!existingStates.has(`${componentId}::${name}`)) newStates.push({ componentId, name });
    }
  }
  for (const part of chunked(newStates)) {
    const created = await tx
      .insert(schema.states)
      .values(part)
      .onConflictDoNothing()
      .returning({ id: schema.states.id });
    report.createdStates += created.length;
  }

  // Свойства: тип проверяется по enum, существующие сравниваются, но не правятся.
  const existingProperties = new Map<string, { id: string; type: string; name: string; componentId: string }>();
  for (const part of chunked(idList)) {
    const rows = await tx
      .select({
        id: schema.properties.id,
        componentId: schema.properties.componentId,
        name: schema.properties.name,
        type: schema.properties.type,
      })
      .from(schema.properties)
      .where(inArray(schema.properties.componentId, part));
    for (const row of rows) {
      if (row.componentId) {
        existingProperties.set(`${row.componentId}::${row.name}`, {
          id: row.id,
          type: row.type,
          name: row.name,
          componentId: row.componentId,
        });
      }
    }
  }

  type Pending = { componentName: string; propertyName: string; aliases: ManifestAlias[] };
  const propertyIds = new Map<string, string>();
  const newProperties: Array<{
    componentId: string;
    name: string;
    type: (typeof schema.propertyTypeEnum.enumValues)[number];
    description: string | null;
  }> = [];
  const aliasCandidates: Pending[] = [];

  for (const component of components) {
    const componentId = componentIds.get(component.name);
    if (!componentId) continue;
    for (const property of component.properties) {
      const key = `${componentId}::${property.name}`;
      const existing = existingProperties.get(key);
      if (existing) {
        if (existing.type === property.type) {
          report.unchangedProperties += 1;
        } else {
          report.typeMismatches.push(
            `${component.name}.${property.name}: db=${existing.type}, meta=${property.type}`,
          );
        }
        propertyIds.set(key, existing.id);
        aliasCandidates.push({
          componentName: component.name,
          propertyName: property.name,
          aliases: property.aliases,
        });
        continue;
      }

      if (!supportedTypes.has(property.type)) {
        report.rejected.push({
          component: component.name,
          property: property.name,
          reason: `unknown property type: ${property.type}`,
        });
        continue;
      }

      newProperties.push({
        componentId,
        name: property.name,
        type: property.type as (typeof schema.propertyTypeEnum.enumValues)[number],
        description: property.description ? property.description : null,
      });
      aliasCandidates.push({
        componentName: component.name,
        propertyName: property.name,
        aliases: property.aliases,
      });
    }
  }

  for (const part of chunked(newProperties)) {
    const created = await tx
      .insert(schema.properties)
      .values(part)
      .onConflictDoNothing()
      .returning({
        id: schema.properties.id,
        componentId: schema.properties.componentId,
        name: schema.properties.name,
      });
    report.createdProperties += created.length;
    for (const row of created) propertyIds.set(`${row.componentId}::${row.name}`, row.id);
  }

  // Платформенные имена. Существующие алиасы свойства на этой платформе не заменяются и не
  // удаляются: у свойства может быть несколько имён, и убирать прежнее — не дело аддитивного
  // импорта. Обновляется только статус устаревания.
  const aliasRows: Array<{ propertyId: string; name: string; deprecation: ManifestAlias["deprecation"] }> = [];
  for (const candidate of aliasCandidates) {
    const componentId = componentIds.get(candidate.componentName);
    const propertyId = componentId
      ? propertyIds.get(`${componentId}::${candidate.propertyName}`)
      : undefined;
    if (propertyId) {
      for (const alias of candidate.aliases) {
        aliasRows.push({ propertyId, name: alias.name, deprecation: alias.deprecation });
      }
    }
  }

  const existingAliases = new Map<
    string,
    { id: string; deprecated: boolean; deprecatedMessage: string | null }
  >();
  const aliasPropertyIds = [...new Set(aliasRows.map((row) => row.propertyId))];
  for (const part of chunked(aliasPropertyIds)) {
    const rows = await tx
      .select({
        id: schema.propertyPlatformParams.id,
        propertyId: schema.propertyPlatformParams.propertyId,
        name: schema.propertyPlatformParams.name,
        deprecated: schema.propertyPlatformParams.deprecated,
        deprecatedMessage: schema.propertyPlatformParams.deprecatedMessage,
      })
      .from(schema.propertyPlatformParams)
      .where(
        and(
          eq(schema.propertyPlatformParams.platform, request.platform),
          inArray(schema.propertyPlatformParams.propertyId, part),
        ),
      );
    for (const row of rows) {
      existingAliases.set(`${row.propertyId}::${row.name}`, {
        id: row.id,
        deprecated: row.deprecated,
        deprecatedMessage: row.deprecatedMessage,
      });
    }
  }

  const newAliases: Array<typeof schema.propertyPlatformParams.$inferInsert> = [];
  for (const row of aliasRows) {
    const known = existingAliases.get(`${row.propertyId}::${row.name}`);
    if (!known) {
      const deprecated = row.deprecation.kind === "deprecated";
      newAliases.push({
        propertyId: row.propertyId,
        platform: request.platform,
        name: row.name,
        deprecated,
        deprecatedMessage: row.deprecation.kind === "deprecated" ? row.deprecation.message : null,
      });
      continue;
    }
    // Уже существующий алиас: меняется только статус устаревания.
    if (row.deprecation.kind === "deprecated") {
      if (!known.deprecated) {
        report.deprecatedMarked += 1;
      } else if (known.deprecatedMessage !== row.deprecation.message) {
        report.deprecatedMessageChanged += 1;
      } else {
        continue;
      }
      known.deprecated = true;
      known.deprecatedMessage = row.deprecation.message;
      await tx
        .update(schema.propertyPlatformParams)
        .set({ deprecated: true, deprecatedMessage: row.deprecation.message })
        .where(eq(schema.propertyPlatformParams.id, known.id));
    } else if (row.deprecation.kind === "current" && known.deprecated) {
      report.deprecatedCleared += 1;
      known.deprecated = false;
      known.deprecatedMessage = null;
      await tx
        .update(schema.propertyPlatformParams)
        .set({ deprecated: false, deprecatedMessage: null })
        .where(eq(schema.propertyPlatformParams.id, known.id));
    }
  }
  for (const part of chunked(newAliases)) {
    const created = await tx
      .insert(schema.propertyPlatformParams)
      .values(part)
      .onConflictDoNothing()
      .returning({ id: schema.propertyPlatformParams.id, deprecated: schema.propertyPlatformParams.deprecated });
    report.createdAliases += created.length;
    report.deprecatedMarked += created.filter((row) => row.deprecated).length;
  }

  // Справочно: что есть в базе для платформы, но нет в мете.
  const manifestComponents = new Set(names);
  const platformComponents = await tx
    .select({ name: schema.components.name })
    .from(schema.components)
    .where(platformIs);
  const absent: string[] = platformComponents
    .map((row) => row.name)
    .filter((name) => !manifestComponents.has(name));
  const manifestProperties = new Set(
    components.flatMap((component) => component.properties.map((property) => `${component.name}.${property.name}`)),
  );
  const nameById = new Map([...componentIds.entries()].map(([name, id]) => [id, name]));
  for (const existing of existingProperties.values()) {
    const componentName = nameById.get(existing.componentId);
    if (componentName && !manifestProperties.has(`${componentName}.${existing.name}`)) {
      absent.push(`${componentName}.${existing.name}`);
    }
  }
  report.absent = absent.sort();

  return report;
};
