// Simple logger utility that respects environment variables
export class Logger {
    private static isTestMode(): boolean {
        return process.env.NODE_ENV === 'test' || !!process.env.JEST_WORKER_ID;
    }

    private static isDebugMode(): boolean {
        return process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';
    }

    static log(message: string, ...args: any[]): void {
        if (!this.isTestMode()) {
            console.log(message, ...args);
        }
    }

    static error(message: string, ...args: any[]): void {
        if (!this.isTestMode()) {
            console.error(message, ...args);
        }
    }

    static warn(message: string, ...args: any[]): void {
        if (!this.isTestMode()) {
            console.warn(message, ...args);
        }
    }

    static debug(message: string, ...args: any[]): void {
        if (this.isDebugMode() && !this.isTestMode()) {
            console.log(`[DEBUG] ${message}`, ...args);
        }
    }

    static info(message: string, ...args: any[]): void {
        if (!this.isTestMode()) {
            console.log(`[INFO] ${message}`, ...args);
        }
    }
}
