import { Body, Controller, Delete, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import type { DeprecateVersionRequestDto } from "@verdaccio-market/types";
import { WriteAuthGuard } from "../auth/guards/write-auth.guard";
import { PublishAdminService } from "./publish-admin.service";

interface RequestWithAuth extends Request {
  authToken?: string;
  authUser?: string;
}

@Controller("packages/:packageName")
export class PublishAdminController {
  public constructor(private readonly publishAdminService: PublishAdminService) {}

  @Post("deprecate")
  @UseGuards(WriteAuthGuard)
  public async deprecate(
    @Param("packageName") packageName: string,
    @Body() body: DeprecateVersionRequestDto,
    @Req() req: RequestWithAuth
  ): Promise<{ ok: true }> {
    return this.publishAdminService.deprecate({
      packageName,
      version: body.version,
      message: body.message,
      token: req.authToken ?? "",
      operator: req.authUser ?? "unknown-user"
    });
  }

  @Delete("versions/:version")
  @UseGuards(WriteAuthGuard)
  public async deleteVersion(
    @Param("packageName") packageName: string,
    @Param("version") version: string,
    @Req() req: RequestWithAuth
  ): Promise<{ ok: true }> {
    return this.publishAdminService.deleteVersion({
      packageName,
      version,
      token: req.authToken ?? "",
      operator: req.authUser ?? "unknown-user"
    });
  }
}
