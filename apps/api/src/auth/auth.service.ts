import { Injectable } from "@nestjs/common";
import type { SessionUserDto } from "@verdaccio-market/types";
import { AppException } from "../common/exceptions/app-exception";
import { AuditService } from "../audit/audit.service";
import type { LoginDto } from "./dto";
import { SessionService } from "./session.service";
import { VerdaccioClientService } from "../verdaccio/verdaccio-client.service";

@Injectable()
export class AuthService {
  public constructor(
    private readonly sessionService: SessionService,
    private readonly verdaccioClient: VerdaccioClientService,
    private readonly auditService: AuditService
  ) {}

  public async login(input: LoginDto): Promise<{ sid: string; user: SessionUserDto }> {
    if (!input.token?.trim()) {
      throw new AppException("VALIDATION_ERROR", "token 不能为空。", 400);
    }

    const whoami = await this.verdaccioClient.whoAmI(input.token.trim());
    const username = input.username?.trim() || whoami.username || "unknown-user";
    const sid = this.sessionService.createSession({
      username,
      token: input.token.trim(),
      createdAt: Date.now()
    });

    this.auditService.record({
      action: "LOGIN",
      operator: username,
      detail: "用户登录成功"
    });

    return {
      sid,
      user: {
        username,
        tokenMasked: this.maskToken(input.token.trim())
      }
    };
  }

  public async validateToken(token: string, preferredUsername?: string): Promise<SessionUserDto> {
    const whoami = await this.verdaccioClient.whoAmI(token.trim());
    return {
      username: preferredUsername?.trim() || whoami.username || "unknown-user",
      tokenMasked: this.maskToken(token.trim())
    };
  }

  public meFromSid(sid: string): SessionUserDto {
    const session = this.sessionService.getSession(sid);
    if (!session) {
      throw new AppException("UNAUTHORIZED", "会话不存在或已过期。", 401);
    }

    return {
      username: session.username,
      tokenMasked: this.maskToken(session.token)
    };
  }

  public logout(sid: string): void {
    const current = this.sessionService.getSession(sid);
    if (current) {
      this.auditService.record({
        action: "LOGOUT",
        operator: current.username,
        detail: "用户退出登录"
      });
    }
    this.sessionService.deleteSession(sid);
  }

  private maskToken(token: string): string {
    if (token.length <= 8) {
      return "****";
    }
    return `${token.slice(0, 4)}****${token.slice(-4)}`;
  }
}
