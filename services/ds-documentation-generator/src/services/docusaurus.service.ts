import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

/**
 * Сервис для сборки Docusaurus проектов
 * Использует прямую сборку с npm cache для оптимизации
 */
@Injectable()
export class DocusaurusService {
  private readonly logger = new Logger(DocusaurusService.name);
  private readonly npmCacheDir: string;

  constructor(private configService: ConfigService) {
    // Используем shared npm cache для ускорения установки
    // По умолчанию:
    // - Linux/Docker: /home/node/.npm (стандартный путь для Docker образов с node user)
    // - macOS/Windows: ~/.npm (домашняя директория текущего пользователя)
    const defaultCacheDir =
      process.platform === "linux"
        ? "/home/node/.npm"
        : path.join(os.homedir(), ".npm");

    this.npmCacheDir =
      this.configService.get<string>("NPM_CACHE_DIR") || defaultCacheDir;
  }

  /**
   * Собирает Docusaurus проект
   * @param projectDir - Путь к директории с проектом
   * @param extraPackages - Дополнительные пакеты для установки (например @salutejs-ds/*)
   * @returns Путь к директории с собранной документацией (build/)
   */
  async build(
    projectDir: string,
    extraPackages: string[] = [],
  ): Promise<string> {
    this.logger.log(`Starting Docusaurus build in: ${projectDir}`);

    try {
      // 1. Устанавливаем зависимости (с npm cache)
      await this.installDependencies(projectDir);

      // 2. Устанавливаем дополнительные пакеты (если есть)
      if (extraPackages.length > 0) {
        await this.installExtraPackages(projectDir, extraPackages);
      }

      // 3. Запускаем build
      await this.buildProject(projectDir);

      // 4. Возвращаем путь к build директории
      const buildDir = path.join(projectDir, "build");
      this.logger.log(`Docusaurus build completed: ${buildDir}`);

      return buildDir;
    } catch (error) {
      this.logger.error(`Docusaurus build failed: ${error.message}`);
      throw new InternalServerErrorException(
        `Docusaurus build failed: ${error.message}`,
      );
    }
  }

  /**
   * Устанавливает основные зависимости проекта
   * Использует npm cache для ускорения повторных установок
   * @param projectDir - Путь к директории проекта
   */
  private async installDependencies(projectDir: string): Promise<void> {
    this.logger.log("Installing dependencies with npm cache...");

    try {
      await this.execCommand(
        `npm ci --cache=${this.npmCacheDir} --prefer-offline`,
        projectDir,
        { timeout: 300000 }, // 5 минут
      );

      this.logger.log("Dependencies installed successfully");
    } catch (error) {
      this.logger.error(`npm ci failed: ${error.message}`);
      throw new Error(`Failed to install dependencies: ${error.message}`);
    }
  }

  /**
   * Устанавливает дополнительные npm пакеты
   * (например @salutejs-ds/sdds_finai)
   * @param projectDir - Путь к директории проекта
   * @param packages - Список пакетов с версиями
   */
  private async installExtraPackages(
    projectDir: string,
    packages: string[],
  ): Promise<void> {
    this.logger.log(`Installing extra packages: ${packages.join(", ")}`);

    const packagesArg = packages.join(" ");

    try {
      await this.execCommand(
        `npm install -E --cache=${this.npmCacheDir} ${packagesArg}`,
        projectDir,
        { timeout: 300000 }, // 5 минут
      );

      this.logger.log("Extra packages installed successfully");
    } catch (error) {
      this.logger.error(`npm install failed: ${error.message}`);
      throw new Error(`Failed to install extra packages: ${error.message}`);
    }
  }

  /**
   * Запускает Docusaurus build
   * @param projectDir - Путь к директории проекта
   */
  private async buildProject(projectDir: string): Promise<void> {
    this.logger.log("Building Docusaurus project...");

    try {
      const { stdout } = await this.execCommand(
        "npm run build",
        projectDir,
        { timeout: 600000 }, // 10 минут
      );

      this.logger.debug(`Build output: ${stdout}`);
      this.logger.log("Docusaurus project built successfully");
    } catch (error) {
      this.logger.error(`Build failed: ${error.message}`);
      throw new Error(`Failed to build Docusaurus project: ${error.message}`);
    }
  }

  /**
   * Выполняет команду в указанной директории
   * @param command - Команда для выполнения
   * @param cwd - Рабочая директория
   * @param options - Дополнительные опции
   */
  private async execCommand(
    command: string,
    cwd: string,
    options?: { timeout?: number },
  ): Promise<{ stdout: string; stderr: string }> {
    // Увеличиваем maxBuffer до 10MB для npm команд с большим выводом
    return execAsync(command, {
      cwd,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      ...options,
    });
  }
}
