import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { HealthController } from "./health/health.controller";
import { HealthService } from "./health/health.service";
import { PackagesController } from "./packages/packages.controller";
import { PackagesService } from "./packages/packages.service";
import { VerdaccioClientService } from "./verdaccio/verdaccio-client.service";
import { CacheService } from "./cache/cache.service";
import { AuthController } from "./auth/auth.controller";
import { AuthService } from "./auth/auth.service";
import { SessionService } from "./auth/session.service";
import { AuditController } from "./audit/audit.controller";
import { AuditService } from "./audit/audit.service";
import { WriteAuthGuard } from "./auth/guards/write-auth.guard";
import { DistTagsController } from "./dist-tags/dist-tags.controller";
import { DistTagsService } from "./dist-tags/dist-tags.service";
import { PublishAdminController } from "./publish-admin/publish-admin.controller";
import { PublishAdminService } from "./publish-admin/publish-admin.service";

@Module({
  imports: [
    // 统一在 BFF 里管理对 Verdaccio 的 HTTP 调用。
    HttpModule
  ],
  controllers: [
    HealthController,
    PackagesController,
    AuthController,
    AuditController,
    DistTagsController,
    PublishAdminController
  ],
  providers: [
    HealthService,
    PackagesService,
    VerdaccioClientService,
    CacheService,
    AuthService,
    SessionService,
    AuditService,
    WriteAuthGuard,
    DistTagsService,
    PublishAdminService
  ]
})
export class AppModule {}
