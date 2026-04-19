import { Injectable } from "@nestjs/common";
import type { HealthResponseDto } from "@verdaccio-market/types";
import { CacheService } from "../cache/cache.service";
import { VerdaccioClientService } from "../verdaccio/verdaccio-client.service";

@Injectable()
export class HealthService {
  public constructor(
    private readonly cacheService: CacheService,
    private readonly verdaccioClient: VerdaccioClientService
  ) {}

  public async getHealth(): Promise<HealthResponseDto> {
    const verdaccioAlive = await this.verdaccioClient.ping();
    const cacheStats = this.cacheService.getStats();

    return {
      service: "verdaccio-market-api",
      status: verdaccioAlive ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      verdaccioUrl: process.env.VERDACCIO_URL ?? "http://localhost:4873",
      cache: cacheStats
    };
  }
}
