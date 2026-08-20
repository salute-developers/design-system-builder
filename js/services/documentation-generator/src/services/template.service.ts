import { Injectable, Logger } from "@nestjs/common";
import * as Handlebars from "handlebars";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Интерфейс для данных генерации проекта
 */
export interface GenerateProjectData {
  projectName: string;
  packageName: string;
  packageVersion: string;
  components: string[];
}

/**
 * Сервис для работы с Handlebars шаблонами
 * Копирует весь Docusaurus проект из src/templates/docusaurus/ во временную директорию
 * Обрабатывает .hbs файлы с помощью Handlebars, остальные файлы копирует как есть
 */
@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private readonly templatesDir = path.join(
    process.cwd(),
    "src/templates/docusaurus",
  );

  constructor() {
    // Регистрируем Handlebars helper для замены дефисов на подчёркивания
    Handlebars.registerHelper("underscore", (value: string) => {
      return value.replace(/-/g, "_");
    });

    // Регистрируем Handlebars helper UpperCase
    Handlebars.registerHelper("uppercase", (value: string) => {
      return value.toUpperCase();
    });
  }

  /**
   * Главный метод - генерирует полный Docusaurus проект во временной директории
   * @param data - Данные о пакете и компонентах
   * @param outputDir - Директория для сохранения проекта
   */
  async generateProject(
    data: GenerateProjectData,
    outputDir: string,
  ): Promise<void> {
    this.logger.log(
      `Generating Docusaurus project from templates to: ${outputDir}`,
    );

    const context = this.buildContext(data);

    await this.copyTemplateStructure(
      this.templatesDir,
      outputDir,
      context,
      data.components,
    );

    this.logger.log("Docusaurus project generation completed");
  }

  /**
   * Рекурсивно копирует структуру директории, обрабатывая .hbs файлы
   * @param sourceDir - Исходная директория
   * @param targetDir - Целевая директория
   * @param context - Контекст для Handlebars
   * @param components - Список компонентов для генерации (опционально)
   */
  private async copyTemplateStructure(
    sourceDir: string,
    targetDir: string,
    context: Record<string, any>,
    components?: string[],
  ): Promise<void> {
    await fs.mkdir(targetDir, { recursive: true });

    const entries = await fs.readdir(sourceDir, { withFileTypes: true });

    // Проверяем, находимся ли мы в директории docs/components
    const isComponentsDir = sourceDir.includes("docs/components");

    for (const entry of entries) {
      const sourcePath = path.join(sourceDir, entry.name);

      if (entry.isDirectory()) {
        // Рекурсивно обрабатываем директории
        const targetPath = path.join(targetDir, entry.name);
        await this.copyTemplateStructure(
          sourcePath,
          targetPath,
          context,
          components,
        );
      } else {
        // Если это файл компонента, проверяем есть ли он в списке
        if (isComponentsDir && entry.name.endsWith(".mdx.hbs")) {
          const componentName = entry.name.replace(".mdx.hbs", "");

          // Пропускаем файл, если компонента нет в списке
          if (components && !components.includes(componentName)) {
            this.logger.debug(
              `Skipping component: ${componentName} (not in components list)`,
            );
            continue;
          }
        }

        // Обрабатываем файлы
        if (entry.name.endsWith(".hbs")) {
          // Handlebars файл - компилируем
          await this.processTemplate(sourcePath, targetDir, context);
        } else {
          // Обычный файл - просто копируем
          const targetPath = path.join(targetDir, entry.name);
          await fs.copyFile(sourcePath, targetPath);
          this.logger.debug(`Copied: ${entry.name}`);
        }
      }
    }
  }

  /**
   * Обрабатывает один .hbs файл с помощью Handlebars
   * @param templatePath - Путь к .hbs файлу
   * @param targetDir - Директория для сохранения результата
   * @param context - Контекст для Handlebars
   */
  private async processTemplate(
    templatePath: string,
    targetDir: string,
    context: Record<string, any>,
  ): Promise<void> {
    const content = await fs.readFile(templatePath, "utf-8");
    const compiled = Handlebars.compile(content);
    const result = compiled(context);

    // Убираем .hbs из имени файла
    const fileName = path.basename(templatePath).replace(".hbs", "");
    const targetPath = path.join(targetDir, fileName);

    await fs.writeFile(targetPath, result, "utf-8");
    this.logger.log(`Processed template: ${fileName}`);
  }

  /**
   * Строит контекст для Handlebars из данных
   * @param data - Данные о пакете и компонентах
   * @returns Контекст для шаблонов
   */
  private buildContext(data: GenerateProjectData): Record<string, any> {
    return {
      // Для *.hbs шаблонов
      projectName: data.projectName,
      packageName: data.packageName,
      packageVersion: data.packageVersion,
    };
  }
}
