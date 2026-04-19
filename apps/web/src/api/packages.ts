import type {
  DistTagsDto,
  PackageDetailDto,
  PaginatedResponseDto,
  PackageSummaryDto,
  PackageVersionDto
} from "@verdaccio-market/types";
import { apiClient } from "./client";

export async function searchPackages(params: {
  query: string;
  page: number;
  pageSize: number;
}): Promise<PaginatedResponseDto<PackageSummaryDto>> {
  const response = await apiClient.get<PaginatedResponseDto<PackageSummaryDto>>("/packages", {
    params
  });
  return response.data;
}

export async function listPrivatePackages(params: {
  page: number;
  pageSize: number;
}): Promise<PaginatedResponseDto<PackageSummaryDto>> {
  const response = await apiClient.get<PaginatedResponseDto<PackageSummaryDto>>("/packages/private/list", {
    params
  });
  return response.data;
}

export async function listRecentPackages(params: {
  page: number;
  pageSize: number;
}): Promise<PaginatedResponseDto<PackageSummaryDto>> {
  const response = await apiClient.get<PaginatedResponseDto<PackageSummaryDto>>("/packages/recent", {
    params
  });
  return response.data;
}

export async function getPackageDetail(packageName: string): Promise<PackageDetailDto> {
  const response = await apiClient.get<PackageDetailDto>(`/packages/${encodeURIComponent(packageName)}`);
  return response.data;
}

export async function getPackageVersions(packageName: string): Promise<PackageVersionDto[]> {
  const response = await apiClient.get<PackageVersionDto[]>(
    `/packages/${encodeURIComponent(packageName)}/versions`
  );
  return response.data;
}

export async function getDistTags(packageName: string): Promise<DistTagsDto> {
  const response = await apiClient.get<DistTagsDto>(
    `/packages/${encodeURIComponent(packageName)}/dist-tags`
  );
  return response.data;
}
