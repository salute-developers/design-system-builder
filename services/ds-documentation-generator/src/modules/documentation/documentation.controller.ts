import { Controller, Post, Get, Body, Logger, Param } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExcludeEndpoint,
  ApiParam,
} from "@nestjs/swagger";
import { DocumentationService } from "./documentation.service";
import {
  GenerateDocsDto,
  DocsResponseDto,
  FetchDesignSystemResponseDto,
} from "./dto";

/**
 * Контроллер для обработки webhook запросов с данными о компонентах
 */
@Controller("documentation")
@ApiTags("documentation")
export class DocumentationController {
  private readonly logger = new Logger(DocumentationController.name);

  constructor(private readonly documentationService: DocumentationService) {}

  /**
   * Генерирует документацию для дизайн-системы по её ID
   * Получает данные из CLIENT_PROXY_URL и создаёт Docusaurus проект
   * @param dto - ID дизайн-системы
   * @returns Метаданные об обработанном запросе
   */
  @Post("generate")
  @ApiOperation({ summary: "Generate documentation for design system by ID" })
  @ApiResponse({
    status: 201,
    description: "Documentation generated successfully",
    type: DocsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Validation failed",
  })
  @ApiResponse({
    status: 404,
    description: "Design system not found",
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error",
  })
  async generate(@Body() dto: GenerateDocsDto): Promise<DocsResponseDto> {
    this.logger.log(
      `Received documentation generation request for design system ID: ${dto.packageName}`,
    );

    return this.documentationService.generate(dto);
  }

  /**
   * Получает данные о дизайн-системе из CLIENT_PROXY_URL
   * @param packageName - Название npm пакета дизайн-системы
   * @param packageVersion - Версия npm пакета дизайн-системы
   * @returns Данные о компонентах и теме дизайн-системы
   */
  @Get("design-systems/:packageName/:packageVersion")
  @ApiOperation({ summary: "Fetch design system data from CLIENT_PROXY_URL" })
  @ApiParam({
    name: "packageName",
    description: "NPM package name of the design system",
    example: "sdds-serv",
    type: String,
  })
  @ApiParam({
    name: "packageVersion",
    description: "NPM package version of the design system",
    example: "0.1.0",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Design system data fetched successfully",
    type: FetchDesignSystemResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Design system not found",
  })
  @ApiResponse({
    status: 500,
    description: "Internal server error",
  })
  async fetchDesignSystemData(
    @Param("packageName") packageName: string,
    @Param("packageVersion") packageVersion: string,
  ): Promise<FetchDesignSystemResponseDto> {
    this.logger.log(
      `Fetching design system data for package: ${packageName}@${packageVersion}`,
    );

    return this.documentationService.fetchDesignSystemData(
      packageName,
      packageVersion,
    );
  }

  /**
   * Health check endpoint для Docker/Kubernetes
   * Проверяет базовую работоспособность сервиса
   */
  @Get("health")
  @ApiOperation({ summary: "Health check endpoint" })
  @ApiExcludeEndpoint()
  health(): { status: string; timestamp: string } {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }
}
