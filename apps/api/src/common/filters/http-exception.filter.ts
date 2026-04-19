import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import type { ApiErrorResponseDto } from "@verdaccio-market/types";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === "object" && payload !== null && "code" in payload) {
        response.status(statusCode).json(payload);
        return;
      }

      const errorBody: ApiErrorResponseDto = {
        code: this.mapStatusToCode(statusCode),
        message: exception.message,
        statusCode
      };
      response.status(statusCode).json(errorBody);
      return;
    }

    const errorBody: ApiErrorResponseDto = {
      code: "INTERNAL_ERROR",
      message: "服务内部异常，请稍后重试。",
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR
    };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorBody);
  }

  private mapStatusToCode(statusCode: number): ApiErrorResponseDto["code"] {
    if (statusCode === HttpStatus.UNAUTHORIZED) {
      return "UNAUTHORIZED";
    }
    if (statusCode === HttpStatus.FORBIDDEN) {
      return "FORBIDDEN";
    }
    if (statusCode === HttpStatus.NOT_FOUND) {
      return "NOT_FOUND";
    }
    if (statusCode === HttpStatus.BAD_REQUEST) {
      return "VALIDATION_ERROR";
    }
    return "VERDACCIO_ERROR";
  }
}
