import { Injectable } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { VerdaccioClientService } from "../verdaccio/verdaccio-client.service";

@Injectable()
export class PublishAdminService {
  public constructor(
    private readonly verdaccioClient: VerdaccioClientService,
    private readonly auditService: AuditService
  ) {}

  public async deprecate(params: {
    packageName: string;
    version: string;
    message: string;
    token: string;
    operator: string;
  }): Promise<{ ok: true }> {
    await this.verdaccioClient.deprecateVersion(params);
    this.auditService.record({
      action: "PACKAGE_DEPRECATE",
      operator: params.operator,
      packageName: params.packageName,
      detail: `废弃版本 ${params.version}，原因：${params.message}`
    });
    return { ok: true };
  }

  public async deleteVersion(params: {
    packageName: string;
    version: string;
    token: string;
    operator: string;
  }): Promise<{ ok: true }> {
    await this.verdaccioClient.deleteVersion(params);
    this.auditService.record({
      action: "VERSION_DELETE",
      operator: params.operator,
      packageName: params.packageName,
      detail: `删除版本 ${params.version}`
    });
    return { ok: true };
  }
}
