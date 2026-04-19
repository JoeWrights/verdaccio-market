import { Injectable } from "@nestjs/common";
import type { AuditAction, AuditRecordDto } from "@verdaccio-market/types";

@Injectable()
export class AuditService {
  private readonly records: AuditRecordDto[] = [];

  public record(params: {
    action: AuditAction;
    operator: string;
    detail: string;
    packageName?: string;
  }): AuditRecordDto {
    const item: AuditRecordDto = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      action: params.action,
      operator: params.operator,
      detail: params.detail,
      packageName: params.packageName,
      createdAt: new Date().toISOString()
    };
    this.records.unshift(item);
    return item;
  }

  public list(): AuditRecordDto[] {
    return this.records;
  }
}
