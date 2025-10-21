import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsNumber,
  IsString,
  IsDateString,
  IsArray,
  ValidateNested,
} from "class-validator";

/**
 * DTO для данных компонента
 */
export class ComponentDto {
  @ApiProperty({ example: "IconButton" })
  @IsString()
  name: string;

  @ApiProperty({ example: "Кнопка с иконкой." })
  @IsString()
  description: string;

  @ApiProperty({ example: "2025-10-31T06:52:12.087Z" })
  @IsDateString()
  createdAt: Date;

  @ApiProperty({ example: "2025-10-31T06:52:12.087Z" })
  @IsDateString()
  updatedAt: Date;

  @ApiProperty({
    type: [String],
    example: ["size", "view", "disabled"],
    description: "Array of component props",
  })
  @IsArray()
  @IsString({ each: true })
  props: string[];
}

/**
 * DTO для ответа от CLIENT_PROXY_URL с данными дизайн-системы
 */
export class FetchDesignSystemResponseDto {
  @ApiProperty({
    type: [ComponentDto],
    description: "Array of component data",
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComponentDto)
  componentsData: ComponentDto[];
}
