import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

/**
 * Глобальный фильтр для перехвата и форматирования всех исключений в приложении
 *
 * Перехватывает любые ошибки (HttpException, Error, и другие) и возвращает
 * унифицированный JSON-ответ с информацией об ошибке.
 *
 * Формат ответа:
 * {
 *   statusCode: number,
 *   message: string,
 *   timestamp: string (ISO),
 *   path: string
 * }
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  /**
   * Обрабатывает любое исключение и формирует стандартизированный HTTP-ответ
   *
   * @param exception - Перехваченное исключение (HttpException, Error или любой другой тип)
   * @param host - Контекст выполнения, содержащий информацию о запросе и ответе
   */
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";

    // Определяем статус и сообщение в зависимости от типа исключения
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      message =
        typeof exceptionResponse === "string"
          ? exceptionResponse
          : (exceptionResponse as any).message || message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Формируем унифицированный ответ
    const errorResponse = {
      statusCode: status,
      message: message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Логируем ошибку с stack trace (если есть)
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      exception instanceof Error ? exception.stack : "",
    );

    // Отправляем ответ клиенту
    response.status(status).json(errorResponse);
  }
}
