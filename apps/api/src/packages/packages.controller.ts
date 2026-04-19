import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Query } from "@nestjs/common";
import type {
  DistTagsDto,
  PackageDetailDto,
  PaginatedResponseDto,
  PackageSummaryDto,
  PackageVersionDto
} from "@verdaccio-market/types";
import { PackagesService } from "./packages.service";

@Controller("packages")
export class PackagesController {
  public constructor(private readonly packagesService: PackagesService) {}

  @Get()
  public async search(
    @Query("query") query?: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query("pageSize", new DefaultValuePipe(10), ParseIntPipe) pageSize = 10
  ): Promise<PaginatedResponseDto<PackageSummaryDto>> {
    return this.packagesService.searchPackages({ query, page, pageSize });
  }

  @Get("private/list")
  public async privateList(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query("pageSize", new DefaultValuePipe(10), ParseIntPipe) pageSize = 10
  ): Promise<PaginatedResponseDto<PackageSummaryDto>> {
    return this.packagesService.listPrivatePackages({ page, pageSize });
  }

  @Get("recent")
  public async recent(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query("pageSize", new DefaultValuePipe(10), ParseIntPipe) pageSize = 10
  ): Promise<PaginatedResponseDto<PackageSummaryDto>> {
    return this.packagesService.listRecentPackages({ page, pageSize });
  }

  @Get(":packageName/versions")
  public async getVersions(@Param("packageName") packageName: string): Promise<PackageVersionDto[]> {
    return this.packagesService.getPackageVersions(packageName);
  }

  @Get(":packageName/dist-tags")
  public async getDistTags(@Param("packageName") packageName: string): Promise<DistTagsDto> {
    return this.packagesService.getDistTags(packageName);
  }

  @Get(":packageName")
  public async getPackageDetail(@Param("packageName") packageName: string): Promise<PackageDetailDto> {
    return this.packagesService.getPackageDetail(packageName);
  }
}
