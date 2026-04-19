import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import type { LoginRequestDto, SessionUserDto } from "@verdaccio-market/types";
import { AppException } from "../common/exceptions/app-exception";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  public constructor(private readonly authService: AuthService) {}

  @Post("login")
  public async login(
    @Body() body: LoginRequestDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<SessionUserDto> {
    const result = await this.authService.login(body);
    response.cookie("sid", result.sid, { httpOnly: true, sameSite: "lax" });
    return result.user;
  }

  @Get("me")
  public async me(@Req() req: Request): Promise<SessionUserDto> {
    const bearer = this.extractBearer(req.headers.authorization ?? "");
    if (bearer) {
      return this.authService.validateToken(bearer);
    }
    const sid = this.getSid(req);
    return this.authService.meFromSid(sid);
  }

  @Post("logout")
  public logout(@Req() req: Request, @Res({ passthrough: true }) response: Response): { ok: true } {
    const sid = this.getSid(req);
    this.authService.logout(sid);
    response.clearCookie("sid");
    return { ok: true };
  }

  private getSid(req: Request): string {
    const sid = this.extractCookie(req.headers.cookie ?? "", "sid");
    if (!sid) {
      throw new AppException("UNAUTHORIZED", "未检测到会话，请先登录。", 401);
    }
    return sid;
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
