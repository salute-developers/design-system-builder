import * as schema from "../db/schema";
import type { ImportComponent } from "../db/import/commonConfig";
import type { TestTx } from "./database";

/**
 * Общие фикстуры тестов компонентной модели.
 *
 * Глобальный слой — компоненты, свойства, токены — импорт не создаёт: он приходит из кода
 * через `scripts/import-uikit-api-meta.sh`. Поэтому тест сначала заводит минимальный
 * глобальный слой внутри своей транзакции, а потом грузит конфигурацию.
 */

export const DS_NAME = "import-test-ds";

export interface Fixture {
  designSystemId: string;
  componentId: string;
  colorToken: string;
  gradientToken: string;
}

/** Заводит дизайн-систему, компонент, свойства и пару токенов: цветовой и градиентный. */
export const seedGlobalLayer = async (
  tx: TestTx,
  properties: Array<{ name: string; type: (typeof schema.propertyTypeEnum.enumValues)[number] }>,
): Promise<Fixture> => {
  const [ds] = await tx
    .insert(schema.designSystems)
    .values({ name: DS_NAME, projectName: "fixture", description: "fixture" })
    .returning();

  const [component] = await tx
    .insert(schema.components)
    .values({ name: "TestButton", description: "fixture" })
    .returning();

  await tx.insert(schema.designSystemComponents).values({
    designSystemId: ds.id,
    componentId: component.id,
  });

  await tx
    .insert(schema.properties)
    .values(properties.map((property) => ({ componentId: component.id, ...property })));

  const [color] = await tx
    .insert(schema.tokens)
    .values({ designSystemId: ds.id, name: "text.default.primary", type: "color" as const })
    .returning();
  const [gradient] = await tx
    .insert(schema.tokens)
    .values({ designSystemId: ds.id, name: "text.default.accent-gradient", type: "gradient" as const })
    .returning();

  return {
    designSystemId: ds.id,
    componentId: component.id,
    colorToken: color.name,
    gradientToken: gradient.name,
  };
};

export const configOf = (config: ImportComponent["config"], styleName = "default"): ImportComponent => ({
  componentName: "TestButton",
  styleName,
  config,
});


/** Публикует версию дизайн-системы: без неё выгрузка отказывает. */
export const publishVersion = async (
  tx: TestTx,
  designSystemId: string,
  version = "1.0.0",
  publishedAt?: Date,
): Promise<void> => {
  await tx.insert(schema.designSystemVersions).values({
    designSystemId,
    version,
    snapshot: {},
    publicationStatus: "published",
    // Время задаётся явно там, где тест различает версии по нему: внутри одной транзакции
    // `now()` одинаков у всех строк.
    ...(publishedAt ? { publishedAt } : {}),
  });
};
