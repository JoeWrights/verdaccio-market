import { Controller, Get, Param, Query } from "@nestjs/common";
import type {
  DistTagsDto,
  PackageDetailDto,
  PaginatedResponseDto,
  PackageSummaryDto,
  PackageVersionDto
} from "@verdaccio-market/types";
import { PackageNameParamDto, PaginationQueryDto, SearchPackagesQueryDto } from "./dto";
import { PackagesService } from "./packages.service";

@Controller("packages")
export class PackagesController {
  public constructor(private readonly packagesService: PackagesService) {}

  @Get()
  public async search(@Query() query: SearchPackagesQueryDto): Promise<PaginatedResponseDto<PackageSummaryDto>> {
    return this.packagesService.searchPackages(query);
  }

  @Get("private/list")
  public async privateList(
    @Query() query: PaginationQueryDto
  ): Promise<PaginatedResponseDto<PackageSummaryDto>> {
    return this.packagesService.listPrivatePackages(query);
  }

  @Get("recent")
  public async recent(@Query() query: PaginationQueryDto): Promise<PaginatedResponseDto<PackageSummaryDto>> {
    return this.packagesService.listRecentPackages(query);
  }

  @Get(":packageName/versions")
  public async getVersions(@Param() params: PackageNameParamDto): Promise<PackageVersionDto[]> {
    return this.packagesService.getPackageVersions(params.packageName);
  }

  @Get(":packageName/dist-tags")
  public async getDistTags(@Param() params: PackageNameParamDto): Promise<DistTagsDto> {
    return this.packagesService.getDistTags(params.packageName);
  }

  @Get(":packageName")
  public async getPackageDetail(@Param() params: PackageNameParamDto): Promise<PackageDetailDto> {
    return this.packagesService.getPackageDetail(params.packageName);
  }
}
