import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { GenerateDocsDto, DocsResponseDto } from "./dto";
import { TemplateService } from "../../services/template.service";
import { DocusaurusService } from "../../services/docusaurus.service";
import { S3Service } from "../../services/s3.service";
import * as path from "path";
import * as fs from "fs/promises";
import * as os from "os";

/**
 * Сервис для обработки запросов на генерацию документации
 */
@Injectable()
export class DocumentationService implements OnModuleInit {
  private readonly logger = new Logger(DocumentationService.name);
  private readonly tmpDirPrefix = "docgen-";

  constructor(
    private readonly templateService: TemplateService,
    private readonly docusaurusService: DocusaurusService,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * Очистка старых временных директорий при старте приложения
   * Защита от утечек при крашах процесса
   */
  async onModuleInit() {
    try {
      const systemTmpDir = os.tmpdir();
      const entries = await fs.readdir(systemTmpDir, { withFileTypes: true });

      // Удаляем все директории, созданные нашим сервисом
      const cleanupPromises = entries
        .filter(
          (entry) =>
            entry.isDirectory() && entry.name.startsWith(this.tmpDirPrefix),
        )
        .map(async (entry) => {
          const dirPath = path.join(systemTmpDir, entry.name);
          try {
            await fs.rm(dirPath, { recursive: true, force: true });
            this.logger.debug(`Cleaned up old temp directory: ${entry.name}`);
          } catch (error) {
            this.logger.warn(
              `Failed to cleanup ${entry.name}: ${error.message}`,
            );
          }
        });

      await Promise.all(cleanupPromises);

      if (cleanupPromises.length > 0) {
        this.logger.log(
          `Cleaned up ${cleanupPromises.length} old temporary directories on startup`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to cleanup temp directories on startup: ${error.message}`,
      );
    }
  }

  /**
   * Обрабатывает webhook payload и генерирует Docusaurus проект
   * @param dto - Входящий payload с информацией о npm пакете и компонентах
   * @returns Метаданные об обработке (путь, ID, время, количество компонентов)
   */
  async generate(dto: GenerateDocsDto): Promise<DocsResponseDto> {
    // Логируем информацию о пакете
    this.logger.log(
      `Received documentation request for package: ${dto.npm.name}@${dto.npm.version}`,
    );
    this.logger.log(`Components: ${dto.components.join(", ")}`);

    // Создаем уникальную временную директорию в системной tmp
    // Префикс + ID гарантирует уникальность и возможность очистки при старте
    const projectDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `${this.tmpDirPrefix}${dto.id}-`),
    );

    this.logger.log(`Generating project to: ${projectDir}`);

    try {
      // Генерируем Docusaurus проект из шаблонов
      await this.templateService.generateProject(dto, projectDir);

      // Формируем список дополнительных пакетов для установки
      const extraPackages = [
        `@salutejs/${dto.npm.name}@${dto.npm.version}`,
        `@salutejs/${dto.npm.themesName}@${dto.npm.themesVersion}`,
      ];

      // Собираем Docusaurus проект через Docker
      const buildDir = await this.docusaurusService.build(
        projectDir,
        extraPackages,
      );

      await this.s3Service.uploadDirectory(buildDir, dto.npm.name);

      this.logger.log(
        `Successfully uploaded to "https://plasma.sberdevices.ru/${dto.npm.name}/"`,
      );

      return {
        outputPath: buildDir,
        projectId: dto.id,
        generatedAt: new Date(),
        componentsCount: dto.components.length,
        documentationLink: `https://plasma.sberdevices.ru/${dto.npm.name}/`,
      };
    } catch (error) {
      // При ошибке логируем
      this.logger.error(`Failed to generate project: ${error.message}`);

      throw error;
    } finally {
      // Очищаем временную директорию проекта в любом случае
      try {
        await fs.rm(projectDir, { recursive: true, force: true });
        this.logger.debug(`Cleaned up temporary directory: ${projectDir}`);
      } catch (cleanupError) {
        this.logger.warn(
          `Failed to cleanup temporary directory ${projectDir}: ${cleanupError.message}`,
        );
      }
    }
  }
}
