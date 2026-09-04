import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly bucket: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly endpoint: string;
  private readonly region: string;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get<string>("AWS_S3_BUCKET");
    this.accessKey = this.configService.get<string>("AWS_ACCESS_KEY_ID");
    this.secretKey = this.configService.get<string>("AWS_SECRET_ACCESS_KEY");
    this.endpoint = this.configService.get<string>("AWS_ENDPOINT");
    this.region = this.configService.get<string>("AWS_REGION");
  }

  /**
   * Upload directory to S3 using s3cmd
   */
  async uploadDirectory(localPath: string, s3Path: string) {
    const s3Destination = `s3://${this.bucket}/dev/${s3Path}`;

    this.logger.log(
      `Starting s3cmd sync from ${localPath} to ${s3Destination}`,
    );

    // Ensure localPath ends with / for s3cmd sync
    const sourcePath = localPath.endsWith("/") ? localPath : `${localPath}/`;

    const command = [
      "s3cmd",
      `--access_key=${this.accessKey}`,
      `--secret_key=${this.secretKey}`,
      `--host=${this.endpoint}`,
      `--host-bucket=${this.endpoint}`,
      `--bucket-location=${this.region}`,
      "--signature-v2",
      "--delete-removed",
      "--no-mime-magic",
      "sync",
      sourcePath,
      `${s3Destination}/`,
    ].join(" ");

    try {
      const { stdout, stderr } = await execAsync(command);

      if (stdout) {
        this.logger.debug(`s3cmd output: ${stdout}`);
      }

      if (stderr) {
        this.logger.warn(`s3cmd stderr: ${stderr}`);
      }

      this.logger.log(`Successfully synced to ${s3Destination}`);
    } catch (error) {
      this.logger.error(`s3cmd sync failed: ${error.message}`);
      throw error;
    }
  }
}
