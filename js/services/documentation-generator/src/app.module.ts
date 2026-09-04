import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DocumentationModule } from "./modules/documentation/documentation.module";
import configuration from "./config/configuration";
import { validationSchema } from "./config/validation.schema";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      load: [configuration],
      validationSchema: validationSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),
    DocumentationModule,
  ],
})
export class AppModule {}
