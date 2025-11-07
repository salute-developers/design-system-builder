import { Module } from "@nestjs/common";
import { DocumentationController } from "./documentation.controller";
import { DocumentationService } from "./documentation.service";
import { TemplateService } from "../../services/template.service";
import { DocusaurusService } from "../../services/docusaurus.service";
import { S3Service } from "../../services/s3.service";

/**
 * Модуль для обработки webhook запросов о компонентах дизайн-системы
 * Отвечает за прием payload и генерацию документации через Handlebars
 */
@Module({
  controllers: [DocumentationController],
  providers: [
    DocumentationService,
    TemplateService,
    DocusaurusService,
    S3Service,
  ],
})
export class DocumentationModule {}
