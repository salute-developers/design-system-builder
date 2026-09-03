import { ApiProperty } from "@nestjs/swagger";

/**
 * DTO для ответа API после обработки webhook
 */
export class DocsResponseDto {
  /** Временная метка обработки */
  @ApiProperty({
    example: "2025-10-01T10:00:00.000Z",
    description: "Generation timestamp",
  })
  generatedAt: Date;

  /** Ссылка на сгенерированную документацию (если деплой в S3) */
  @ApiProperty({
    example: "https://plasma.sberdevices.ru/dev/sdds-finai/",
    description: "Link to generated documentation (only for S3 deploy)",
    required: false,
  })
  documentationLink?: string;

  /** Локальный путь к сгенерированному проекту (если localOnly=true) */
  @ApiProperty({
    example: "/Users/user/project/generated-docs/my-design-system",
    description:
      "Local path to generated Docusaurus project (only for local generation)",
    required: false,
  })
  localPath?: string;
}
