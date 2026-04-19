import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import axios from "axios";
import { firstValueFrom } from "rxjs";
import { AppException } from "../common/exceptions/app-exception";

interface VerdaccioPackageMeta {
  name: string;
  description?: string;
  readme?: string;
  "dist-tags"?: Record<string, string>;
  versions?: Record<string, { deprecated?: string }>;
}

interface VerdaccioPrivatePackageIndexItem extends VerdaccioPackageMeta {
  time?: string;
}

@Injectable()
export class VerdaccioClientService {
  public constructor(private readonly httpService: HttpService) {}

  private get baseUrl(): string {
    return process.env.VERDACCIO_URL ?? "http://localhost:4873";
  }

  public async ping(): Promise<boolean> {
    try {
      await firstValueFrom(this.httpService.get(`${this.baseUrl}/-/ping`));
      return true;
    } catch {
      return false;
    }
  }

  public async whoAmI(token: string): Promise<{ username: string }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{ username: string }>(`${this.baseUrl}/-/whoami`, {
          headers: {
            authorization: `Bearer ${token}`
          }
        })
      );
      return response.data;
    } catch (error) {
      this.handleAxiosError(error, "token 无效或未授权。");
    }
  }

  public async getPackageMeta(packageName: string): Promise<VerdaccioPackageMeta> {
    try {
      // npm 包名可能含有 @scope，因此需要编码后再拼接 URL。
      const encodedName = encodeURIComponent(packageName);
      const response = await firstValueFrom(
        this.httpService.get<VerdaccioPackageMeta>(`${this.baseUrl}/${encodedName}`)
      );
      return response.data;
    } catch (error) {
      this.handleAxiosError(error, `读取包 ${packageName} 元数据失败。`);
    }
  }

  public async searchPackages(query: string): Promise<VerdaccioPackageMeta[]> {
    try {
      // Verdaccio 5 对 npm registry 的搜索接口兼容较弱，先使用全文接口并做兜底。
      const response = await firstValueFrom(
        this.httpService.get<{ objects?: Array<{ package?: VerdaccioPackageMeta }> }>(
          `${this.baseUrl}/-/v1/search?text=${encodeURIComponent(query)}&size=50&from=0`
        )
      );
      const objects = response.data.objects ?? [];
      const result = objects
        .map((item) => item.package)
        .filter((item): item is VerdaccioPackageMeta => Boolean(item?.name));

      if (result.length > 0) {
        return result;
      }
    } catch {
      // 当实例不支持搜索接口时，继续走精确包名兜底。
    }

    try {
      const exact = await this.getPackageMeta(query);
      return [exact];
    } catch {
      return [];
    }
  }

  public async listPrivatePackages(): Promise<VerdaccioPrivatePackageIndexItem[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<unknown>(`${this.baseUrl}/-/verdaccio/data/packages`)
      );
      const payload = response.data;
      if (Array.isArray(payload)) {
        return payload.filter((item): item is VerdaccioPrivatePackageIndexItem => {
          return typeof item === "object" && item !== null && "name" in item;
        });
      }
      return [];
    } catch (error) {
      this.handleAxiosError(error, "读取私服包列表失败。");
    }
  }

  public async getDistTags(packageName: string): Promise<Record<string, string>> {
    const meta = await this.getPackageMeta(packageName);
    return meta["dist-tags"] ?? {};
  }

  public async upsertDistTag(params: {
    packageName: string;
    tagName: string;
    version: string;
    token: string;
  }): Promise<void> {
    try {
      const encoded = encodeURIComponent(params.packageName);
      await firstValueFrom(
        this.httpService.put(`${this.baseUrl}/-/package/${encoded}/dist-tags/${params.tagName}`, params.version, {
          headers: {
            authorization: `Bearer ${params.token}`,
            "content-type": "application/json"
          }
        })
      );
    } catch (error) {
      this.handleAxiosError(error, "更新 dist-tag 失败。");
    }
  }

  public async deleteDistTag(params: { packageName: string; tagName: string; token: string }): Promise<void> {
    try {
      const encoded = encodeURIComponent(params.packageName);
      await firstValueFrom(
        this.httpService.delete(`${this.baseUrl}/-/package/${encoded}/dist-tags/${params.tagName}`, {
          headers: {
            authorization: `Bearer ${params.token}`
          }
        })
      );
    } catch (error) {
      this.handleAxiosError(error, "删除 dist-tag 失败。");
    }
  }

  public async deprecateVersion(params: {
    packageName: string;
    version: string;
    message: string;
    token: string;
  }): Promise<void> {
    const meta = await this.getPackageMeta(params.packageName);
    const encoded = encodeURIComponent(params.packageName);
    const versions = meta.versions ?? {};
    if (!versions[params.version]) {
      throw new AppException("NOT_FOUND", `版本 ${params.version} 不存在。`, 404);
    }
    versions[params.version] = {
      ...versions[params.version],
      deprecated: params.message
    };
    try {
      await firstValueFrom(
        this.httpService.put(`${this.baseUrl}/${encoded}`, { ...meta, versions }, {
          headers: {
            authorization: `Bearer ${params.token}`
          }
        })
      );
    } catch (error) {
      this.handleAxiosError(error, "废弃版本失败。");
    }
  }

  public async deleteVersion(params: { packageName: string; version: string; token: string }): Promise<void> {
    try {
      const encoded = encodeURIComponent(params.packageName);
      await firstValueFrom(
        this.httpService.delete(`${this.baseUrl}/${encoded}/-/${params.version}`, {
          headers: {
            authorization: `Bearer ${params.token}`
          }
        })
      );
    } catch (error) {
      this.handleAxiosError(error, "删除版本失败。");
    }
  }

  private handleAxiosError(error: unknown, defaultMessage: string): never {
    if (axios.isAxiosError(error)) {
      const statusCode = error.response?.status ?? 500;
      if (statusCode === 401) {
        throw new AppException("UNAUTHORIZED", defaultMessage, 401);
      }
      if (statusCode === 403) {
        throw new AppException("FORBIDDEN", defaultMessage, 403);
      }
      if (statusCode === 404) {
        throw new AppException("NOT_FOUND", defaultMessage, 404);
      }
      throw new AppException("VERDACCIO_ERROR", defaultMessage, statusCode);
    }
    throw new AppException("INTERNAL_ERROR", defaultMessage, 500);
  }
}
