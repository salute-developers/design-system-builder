import * as fs from 'fs';
import * as path from 'path';

interface RequestResponseData {
  timestamp: string;
  method: string;
  url: string;
  request: {
    headers: Record<string, string>;
    body?: any;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: any;
  };
}

export class RequestLogger {
  private static instance: RequestLogger;
  private logDir: string;

  private constructor() {
    this.logDir = path.join(process.cwd(), 'tests', 'example-req-resp');
    this.ensureLogDirectory();
  }

  public static getInstance(): RequestLogger {
    if (!RequestLogger.instance) {
      RequestLogger.instance = new RequestLogger();
    }
    return RequestLogger.instance;
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private sanitizeFilename(url: string, method: string): string {
    // Extract path segments and create a safe filename
    const urlPath = url.replace(/[^a-zA-Z0-9\-_]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${method}_${urlPath}_${timestamp}.json`;
  }

  public logRequestResponse(
    method: string,
    url: string,
    requestHeaders: Record<string, string>,
    requestBody: any,
    responseStatus: number,
    responseHeaders: Record<string, string>,
    responseBody: any
  ): void {
    try {
      const data: RequestResponseData = {
        timestamp: new Date().toISOString(),
        method: method.toUpperCase(),
        url,
        request: {
          headers: requestHeaders,
          body: requestBody
        },
        response: {
          status: responseStatus,
          headers: responseHeaders,
          body: responseBody
        }
      };

      const filename = this.sanitizeFilename(url, method);
      const filepath = path.join(this.logDir, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
      console.log(`📝 Logged request/response to: ${filepath}`);
    } catch (error) {
      console.error('❌ Failed to log request/response:', error);
    }
  }

  public logRequest(
    method: string,
    url: string,
    requestHeaders: Record<string, string>,
    requestBody: any
  ): void {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        method: method.toUpperCase(),
        url,
        request: {
          headers: requestHeaders,
          body: requestBody
        }
      };

      const filename = this.sanitizeFilename(url, method) + '.request';
      const filepath = path.join(this.logDir, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
      console.log(`📝 Logged request to: ${filepath}`);
    } catch (error) {
      console.error('❌ Failed to log request:', error);
    }
  }

  public logResponse(
    method: string,
    url: string,
    responseStatus: number,
    responseHeaders: Record<string, string>,
    responseBody: any
  ): void {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        method: method.toUpperCase(),
        url,
        response: {
          status: responseStatus,
          headers: responseHeaders,
          body: responseBody
        }
      };

      const filename = this.sanitizeFilename(url, method) + '.response';
      const filepath = path.join(this.logDir, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
      console.log(`📝 Logged response to: ${filepath}`);
    } catch (error) {
      console.error('❌ Failed to log response:', error);
    }
  }
}
