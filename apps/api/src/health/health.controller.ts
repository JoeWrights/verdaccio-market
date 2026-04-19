import { Controller, Get } from "@nestjs/common";
import type { HealthResponseDto } from "@verdaccio-market/types";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  public constructor(private readonly healthService: HealthService) {}

  @Get()
  public async getHealth(): Promise<HealthResponseDto> {
    return this.healthService.getHealth();
  }
}
