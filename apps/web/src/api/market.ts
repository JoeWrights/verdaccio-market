import type { HealthResponseDto, PackageDetailDto } from "@verdaccio-market/types";
import { apiClient } from "./client";

export async function fetchHealth(): Promise<HealthResponseDto> {
  const response = await apiClient.get<HealthResponseDto>("/health");
  return response.data;
}

export async function fetchPackageDetail(packageName: string): Promise<PackageDetailDto> {
  const response = await apiClient.get<PackageDetailDto>(`/packages/${encodeURIComponent(packageName)}`);
  return response.data;
}
