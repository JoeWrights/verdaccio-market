import { Injectable } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { VerdaccioClientService } from "../verdaccio/verdaccio-client.service";

@Injectable()
export class DistTagsService {
  public constructor(
    private readonly verdaccioClient: VerdaccioClientService,
    private readonly auditService: AuditService
  ) {}

  public async upsertTag(params: {
    packageName: string;
    tagName: string;
    version: string;
    token: string;
    operator: string;
  }): Promise<{ ok: true }> {
    await this.verdaccioClient.upsertDistTag(params);
    this.auditService.record({
      action: "TAG_UPSERT",
      operator: params.operator,
      packageName: params.packageName,
      detail: `更新 tag ${params.tagName} -> ${params.version}`
    });
    return { ok: true };
  }

  public async deleteTag(params: {
    packageName: string;
    tagName: string;
    token: string;
    operator: string;
  }): Promise<{ ok: true }> {
    await this.verdaccioClient.deleteDistTag(params);
    this.auditService.record({
      action: "TAG_DELETE",
      operator: params.operator,
      packageName: params.packageName,
      detail: `删除 tag ${params.tagName}`
    });
    return { ok: true };
  }
}
