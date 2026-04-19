import type { AuditRecordDto } from "@verdaccio-market/types";
import { apiClient } from "./client";

export async function getAudits(): Promise<AuditRecordDto[]> {
  const response = await apiClient.get<AuditRecordDto[]>("/audits");
  return response.data;
}
