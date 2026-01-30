import {
  Injectable,
  Logger,
  OnModuleInit,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  GenerateDocsDto,
  DocsResponseDto,
  FetchDesignSystemResponseDto,
} from "./dto";
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
    private readonly configService: ConfigService,
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
   * Обрабатывает запрос на генерацию документации
   * Получает данные о дизайн-системе из CLIENT_PROXY_URL и генерирует Docusaurus проект
   * @param dto - ID дизайн-системы
   * @returns Метаданные об обработке (путь, ID, время, количество компонентов)
   */
  async generate(dto: GenerateDocsDto): Promise<DocsResponseDto> {
    this.logger.log(
      `Received documentation generation request for DS Package: ${dto.packageName}@${dto.packageVersion}`,
    );

    // Получаем данные о дизайн-системе из CLIENT_PROXY_URL
    const designSystemData = await this.fetchDesignSystemData(
      dto.packageName,
      dto.packageVersion,
      dto.authToken,
    );

    this.logger.log(
      `Fetched design system: ${dto.packageName} with ${designSystemData.componentsData.length} components`,
    );

    // Извлекаем названия компонентов из массива
    const componentNames = designSystemData.componentsData.map(
      (comp) => comp.name || "Unknown",
    );

    this.logger.log(`Components: ${componentNames.join(", ")}`);

    // Подготавливаем данные для шаблонов
    const templateData = {
      projectName: dto.projectName,
      packageName: dto.packageName,
      packageVersion: dto.packageVersion,
      components: componentNames,
    };

    // Если флаг localOnly - генерируем только локально без сборки и деплоя
    if (dto.localOnly) {
      this.logger.log(
        `Local only mode enabled - skipping build and deploy to S3`,
      );

      const localPath = await this.generateLocalProject(
        dto.packageName,
        templateData,
      );

      return {
        generatedAt: new Date(),
        localPath,
      };
    }

    // Создаем уникальную временную директорию в системной tmp
    const projectDir = await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        `${this.tmpDirPrefix}${dto.packageName}-${dto.packageVersion}-`,
      ),
    );

    this.logger.log(`Generating project to: ${projectDir}`);

    try {
      // Генерируем Docusaurus проект из шаблонов
      await this.templateService.generateProject(templateData, projectDir);

      // Формируем список дополнительных пакетов для установки
      const extraPackages = [`@salutejs-ds/${dto.packageName}@latest`];

      // Собираем Docusaurus проект через Docker
      const buildDir = await this.docusaurusService.build(
        projectDir,
        extraPackages,
      );

      await this.s3Service.uploadDirectory(buildDir, dto.packageName);

      this.logger.log(
        `Successfully uploaded to "https://plasma.sberdevices.ru/dev/${dto.packageName}/"`,
      );

      return {
        generatedAt: new Date(),
        documentationLink: `https://plasma.sberdevices.ru/dev/${dto.packageName}/`,
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

  /**
   * Генерирует Docusaurus проект локально без сборки и деплоя
   * @param designSystemName - Название дизайн-системы
   * @param templateData - Данные для шаблонов
   * @returns Путь к созданному локальному проекту
   */
  private async generateLocalProject(
    designSystemName: string,
    templateData: any,
  ): Promise<string> {
    // Получаем базовую директорию для локальных проектов из env или используем дефолтную
    const baseDir =
      this.configService.get<string>("LOCAL_DOCS_OUTPUT_DIR") ||
      path.join(process.cwd(), "generated-docs");

    const localPath = path.join(baseDir, designSystemName);

    this.logger.log(`Generating local project to: ${localPath}`);

    // Создаем директорию (если существует - перезаписываем)
    await fs.mkdir(localPath, { recursive: true });

    // Генерируем Docusaurus проект из шаблонов
    await this.templateService.generateProject(templateData, localPath);

    this.logger.log(
      `Successfully generated local Docusaurus project at: ${localPath}`,
    );

    return localPath;
  }

  /**
   * Получает данные о дизайн-системе из CLIENT_PROXY_URL
   */
  async fetchDesignSystemData(
    packageName: string,
    packageVersion: string,
    authToken?: string,
  ): Promise<FetchDesignSystemResponseDto> {
    const baseUrl =
      this.configService.get<string>("CLIENT_PROXY_URL") ||
      "http://localhost:3003/api";

    const url = `${baseUrl}/design-systems/${encodeURIComponent(packageName)}/${encodeURIComponent(packageVersion)}`;

    this.logger.log(`Fetching design system data from: ${url}`);

    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Basic ${authToken}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new HttpException(
          `Failed to fetch design system data: ${response.statusText}`,
          response.status,
        );
      }

      const data = await response.json();

      this.logger.log(
        `Successfully fetched design system data for package: ${packageName}@${packageVersion}`,
      );

      return data as FetchDesignSystemResponseDto;
    } catch (error) {
      this.logger.error(`Failed to fetch design system data: ${error.message}`);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to fetch design system data: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
