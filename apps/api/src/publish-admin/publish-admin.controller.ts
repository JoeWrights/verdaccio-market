import { Body, Controller, Delete, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { WriteAuthGuard } from "../auth/guards/write-auth.guard";
import { DeprecateVersionBodyDto, PackageNameParamDto, PackageVersionParamDto } from "./dto";
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
    @Param() params: PackageNameParamDto,
    @Body() body: DeprecateVersionBodyDto,
    @Req() req: RequestWithAuth
  ): Promise<{ ok: true }> {
    return this.publishAdminService.deprecate({
      packageName: params.packageName,
      version: body.version,
      message: body.message,
      token: req.authToken ?? "",
      operator: req.authUser ?? "unknown-user"
    });
  }

  @Delete("versions/:version")
  @UseGuards(WriteAuthGuard)
  public async deleteVersion(@Param() params: PackageVersionParamDto, @Req() req: RequestWithAuth): Promise<{ ok: true }> {
    return this.publishAdminService.deleteVersion({
      packageName: params.packageName,
      version: params.version,
      token: req.authToken ?? "",
      operator: req.authUser ?? "unknown-user"
    });
  }
}
