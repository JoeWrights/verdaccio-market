import { Controller, Get } from "@nestjs/common";
import type { AuditRecordDto } from "@verdaccio-market/types";
import { AuditService } from "./audit.service";

@Controller("audits")
export class AuditController {
  public constructor(private readonly auditService: AuditService) {}

  @Get()
  public list(): AuditRecordDto[] {
    return this.auditService.list();
  }
}
