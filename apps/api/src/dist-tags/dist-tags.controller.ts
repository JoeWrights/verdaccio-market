import { Body, Controller, Delete, Param, Put, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { WriteAuthGuard } from "../auth/guards/write-auth.guard";
import { PackageTagParamDto, UpsertTagBodyDto } from "./dto";
import { DistTagsService } from "./dist-tags.service";

interface RequestWithAuth extends Request {
  authToken?: string;
  authUser?: string;
}

@Controller("packages/:packageName/dist-tags")
export class DistTagsController {
  public constructor(private readonly distTagsService: DistTagsService) {}

  @Put(":tagName")
  @UseGuards(WriteAuthGuard)
  public async upsertTag(
    @Param() params: PackageTagParamDto,
    @Body() body: UpsertTagBodyDto,
    @Req() req: RequestWithAuth
  ): Promise<{ ok: true }> {
    return this.distTagsService.upsertTag({
      packageName: params.packageName,
      tagName: params.tagName,
      version: body.version,
      token: req.authToken ?? "",
      operator: req.authUser ?? "unknown-user"
    });
  }

  @Delete(":tagName")
  @UseGuards(WriteAuthGuard)
  public async deleteTag(@Param() params: PackageTagParamDto, @Req() req: RequestWithAuth): Promise<{ ok: true }> {
    return this.distTagsService.deleteTag({
      packageName: params.packageName,
      tagName: params.tagName,
      token: req.authToken ?? "",
      operator: req.authUser ?? "unknown-user"
    });
  }
}
