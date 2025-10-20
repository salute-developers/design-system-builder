import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsDateString,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * DTO для информации о npm пакете
 */
export class NpmDto {
  /** Название npm пакета (короткое, без namespace) */
  @ApiProperty({
    example: "sdds-finai",
    description:
      "Package name without namespace (e.g., sdds-finai, plasma-giga)",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  /** Версия npm пакета */
  @ApiProperty({ example: "0.316.0" })
  @IsString()
  @IsNotEmpty()
  version: string;

  /** Название пакета с темами */
  @ApiProperty({
    example: "sdds-themes",
    description: "Theme package name (without namespace)",
  })
  @IsString()
  @IsNotEmpty()
  themesName: string;

  /** Версия пакета с темами */
  @ApiProperty({
    example: "0.47.0",
    description: "Theme package version",
  })
  @IsString()
  @IsNotEmpty()
  themesVersion: string;
}

/**
 * DTO для входящего webhook payload с данными о компонентах
 */
export class GenerateDocsDto {
  /** Уникальный идентификатор payload */
  @ApiProperty({
    example: "sdds-1",
    description: "Unique payload identifier",
  })
  @IsString()
  @IsNotEmpty()
  id: string;

  /** Временная метка создания payload */
  @ApiProperty({
    example: "2025-10-02T12:00:00.000Z",
    description: "Timestamp of the payload",
  })
  @IsDateString()
  time: Date;

  /** Информация о npm пакете (название и версия) */
  @ApiProperty({
    type: NpmDto,
    description: "NPM package information",
  })
  @ValidateNested()
  @Type(() => NpmDto)
  npm: NpmDto;

  /** Массив названий компонентов из пакета */
  @ApiProperty({
    example: ["Button", "Checkbox", "Radiobox"],
    description: "Array of component names",
  })
  @IsArray()
  @IsString({ each: true })
  components: string[];
}
