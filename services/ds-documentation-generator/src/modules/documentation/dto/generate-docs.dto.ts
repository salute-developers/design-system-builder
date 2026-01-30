import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
} from "class-validator";

/**
 * DTO для запроса на генерацию документации
 */
export class GenerateDocsDto {
  /** Название проекта для отображения в документации */
  @ApiProperty({
    example: "FinAI Core",
    description: "Project display name for documentation",
  })
  @IsString()
  @IsNotEmpty()
  projectName: string;

  /** Название npm пакета дизайн-системы */
  @ApiProperty({
    example: "sdds-serv",
    description: "NPM package name of the design system",
  })
  @IsString()
  @IsNotEmpty()
  packageName: string;

  /** Версия npm пакета дизайн-системы */
  @ApiProperty({
    example: "0.1.0",
    description: "NPM package version of the design system",
  })
  @IsString()
  @IsNotEmpty()
  packageVersion: string;

  /** Флаг для генерации только локально без сборки и деплоя */
  @ApiProperty({
    example: false,
    description:
      "Generate only local Docusaurus project without build and deploy to S3",
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  localOnly?: boolean;

  /** Токен авторизации для запросов к client-proxy */
  @ApiProperty({
    example: "dXNlcjpwYXNz",
    description: "Auth token for client-proxy authorization",
    required: false,
  })
  @IsOptional()
  @IsString()
  authToken?: string;
}
