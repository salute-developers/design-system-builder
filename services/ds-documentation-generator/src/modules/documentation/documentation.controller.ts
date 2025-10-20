import { Controller, Post, Body, Logger } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { DocumentationService } from "./documentation.service";
import { GenerateDocsDto, DocsResponseDto } from "./dto";

/**
 * Контроллер для обработки webhook запросов с данными о компонентах
 */
@Controller("documentation")
@ApiTags("documentation")
export class DocumentationController {
  private readonly logger = new Logger(DocumentationController.name);

  constructor(private readonly documentationService: DocumentationService) {}

  /**
   * Принимает webhook с данными о компонентах npm пакета
   * @param dto - Payload с информацией о пакете и компонентах
   * @returns Метаданные об обработанном запросе
   */
  @Post("generate")
  @ApiOperation({ summary: "Generate documentation from components data" })
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
    status: 500,
    description: "Internal server error",
  })
  async generate(@Body() dto: GenerateDocsDto): Promise<DocsResponseDto> {
    // Логируем полученный payload для отладки
    this.logger.log("Received payload:");
    console.log(JSON.stringify(dto, null, 2));

    return this.documentationService.generate(dto);
  }
}
