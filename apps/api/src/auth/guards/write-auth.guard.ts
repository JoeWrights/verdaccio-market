import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { AppException } from "../../common/exceptions/app-exception";
import { SessionService } from "../session.service";

interface RequestWithAuth extends Request {
  authToken?: string;
  authUser?: string;
}

@Injectable()
export class WriteAuthGuard implements CanActivate {
  public constructor(private readonly sessionService: SessionService) {}

  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();

    const bearer = this.extractBearer(request.headers.authorization ?? "");
    if (bearer) {
      request.authToken = bearer;
      request.authUser = "token-user";
      return true;
    }

    const sid = this.extractCookie(request.headers.cookie ?? "", "sid");
    if (sid) {
      const session = this.sessionService.getSession(sid);
      if (session) {
        request.authToken = session.token;
        request.authUser = session.username;
        return true;
      }
    }

    throw new AppException("UNAUTHORIZED", "写操作需要登录或携带 Bearer token。", 401);
  }

  private extractBearer(authorization: string): string {
    if (!authorization.startsWith("Bearer ")) {
      return "";
    }
    return authorization.slice("Bearer ".length).trim();
  }

  private extractCookie(rawCookie: string, key: string): string {
    const pairs = rawCookie
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);
    for (const pair of pairs) {
      const [cookieKey, cookieValue] = pair.split("=");
      if (cookieKey === key) {
        return cookieValue ?? "";
      }
    }
    return "";
  }
}
