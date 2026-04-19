import { HttpException } from "@nestjs/common";
import type { ApiErrorCode } from "@verdaccio-market/types";

/**
 * 统一业务异常，确保前端能收到稳定错误码与状态码。
 */
export class AppException extends HttpException {
  public constructor(
    public readonly code: ApiErrorCode,
    message: string,
    statusCode: number
  ) {
    super({ code, message, statusCode }, statusCode);
  }
}
