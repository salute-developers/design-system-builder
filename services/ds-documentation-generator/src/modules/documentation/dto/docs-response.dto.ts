import { ApiProperty } from "@nestjs/swagger";

/**
 * DTO для ответа API после обработки webhook
 */
export class DocsResponseDto {
  /** Путь к сгенерированной документации */
  @ApiProperty({
    example: "/output/my-design-system",
    description: "Path to generated documentation",
  })
  outputPath: string;

  /** Идентификатор проекта */
  @ApiProperty({
    example: "my-design-system",
    description: "Project identifier",
  })
  projectId: string;

  /** Временная метка обработки */
  @ApiProperty({
    example: "2025-10-01T10:00:00.000Z",
    description: "Generation timestamp",
  })
  generatedAt: Date;

  /** Количество обработанных компонентов */
  @ApiProperty({
    example: 5,
    description: "Number of components documented",
  })
  componentsCount: number;

  /** Количество обработанных компонентов */
  @ApiProperty({
    example: "https://plasma.sberdevices.ru/dev/sdds-finai/",
    description: "Link to generated documentation",
  })
  documentationLink: string;
}
