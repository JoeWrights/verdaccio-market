import { Injectable } from "@nestjs/common";
import type {
  DistTagsDto,
  PackageDetailDto,
  PaginatedResponseDto,
  PackageSummaryDto,
  PackageVersionDto
} from "@verdaccio-market/types";
import { CacheService } from "../cache/cache.service";
import { VerdaccioClientService } from "../verdaccio/verdaccio-client.service";

@Injectable()
export class PackagesService {
  public constructor(
    private readonly verdaccioClient: VerdaccioClientService,
    private readonly cacheService: CacheService
  ) {}

  public async getPackageDetail(packageName: string): Promise<PackageDetailDto> {
    const cacheKey = `package:detail:${packageName}`;
    const cached = this.cacheService.get<PackageDetailDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const meta = await this.verdaccioClient.getPackageMeta(packageName);
    const distTags = meta["dist-tags"] ?? {};
    const versions = Object.keys(meta.versions ?? {});
    const latestVersion = distTags.latest ?? versions.at(-1) ?? "unknown";
    const result: PackageDetailDto = {
      name: meta.name,
      latestVersion,
      distTags,
      versions,
      description: meta.description ?? "",
      readme: meta.readme ?? ""
    };
    this.cacheService.set(cacheKey, result);
    return result;
  }

  public async searchPackages(params: {
    query?: string;
    page: number;
    pageSize: number;
  }): Promise<PaginatedResponseDto<PackageSummaryDto>> {
    const { query, page, pageSize } = params;
    if (!query) {
      return {
        items: [],
        page,
        pageSize,
        total: 0
      };
    }

    const data = await this.verdaccioClient.searchPackages(query);
    const summaries: PackageSummaryDto[] = data.map((item) => {
      const versions = Object.keys(item.versions ?? {});
      const latestVersion = item["dist-tags"]?.latest ?? versions.at(-1) ?? "unknown";
      return {
        name: item.name,
        latestVersion,
        description: item.description ?? "",
        versionCount: versions.length,
        updatedAt: undefined
      };
    });

    const total = summaries.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      items: summaries.slice(start, end),
      page,
      pageSize,
      total
    };
  }

  public async listPrivatePackages(params: {
    page: number;
    pageSize: number;
  }): Promise<PaginatedResponseDto<PackageSummaryDto>> {
    const data = await this.verdaccioClient.listPrivatePackages();
    const summaries: PackageSummaryDto[] = data.map((item) => {
      const versions = Object.keys(item.versions ?? {});
      const latestVersion = item["dist-tags"]?.latest ?? versions.at(-1) ?? "unknown";
      return {
        name: item.name,
        latestVersion,
        description: item.description ?? "",
        versionCount: versions.length,
        updatedAt: item.time
      };
    });

    const total = summaries.length;
    const start = (params.page - 1) * params.pageSize;
    const end = start + params.pageSize;
    return {
      items: summaries.slice(start, end),
      page: params.page,
      pageSize: params.pageSize,
      total
    };
  }

  public async listRecentPackages(params: {
    page: number;
    pageSize: number;
  }): Promise<PaginatedResponseDto<PackageSummaryDto>> {
    const data = await this.verdaccioClient.listPrivatePackages();
    const summaries: PackageSummaryDto[] = data
      .map((item) => {
        const versions = Object.keys(item.versions ?? {});
        const latestVersion = item["dist-tags"]?.latest ?? versions.at(-1) ?? "unknown";
        return {
          name: item.name,
          latestVersion,
          description: item.description ?? "",
          versionCount: versions.length,
          updatedAt: item.time
        };
      })
      .sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      });

    const total = summaries.length;
    const start = (params.page - 1) * params.pageSize;
    const end = start + params.pageSize;
    return {
      items: summaries.slice(start, end),
      page: params.page,
      pageSize: params.pageSize,
      total
    };
  }

  public async getPackageVersions(packageName: string): Promise<PackageVersionDto[]> {
    const meta = await this.verdaccioClient.getPackageMeta(packageName);
    const entries = Object.entries(meta.versions ?? {});
    return entries
      .map(([version, detail]) => ({
        version,
        deprecated: detail.deprecated
      }))
      .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  }

  public async getDistTags(packageName: string): Promise<DistTagsDto> {
    const tags = await this.verdaccioClient.getDistTags(packageName);
    return {
      packageName,
      tags
    };
  }
}
