/**
 * BFF 健康检查响应结构。
 */
export interface HealthResponseDto {
  service: string;
  status: "ok" | "degraded";
  timestamp: string;
  verdaccioUrl: string;
  cache: {
    size: number;
    hits: number;
    misses: number;
  };
}

/**
 * 列表页最小包摘要信息。
 */
export interface PackageSummaryDto {
  name: string;
  latestVersion: string;
  description: string;
  versionCount: number;
  updatedAt?: string;
}

/**
 * 包详情的精简结构，避免前端直接依赖 Verdaccio 原始元数据格式。
 */
export interface PackageDetailDto {
  name: string;
  latestVersion: string;
  distTags: Record<string, string>;
  versions: string[];
  description: string;
  readme: string;
}

/**
 * 分页查询参数。
 */
export interface PaginationQueryDto {
  page: number;
  pageSize: number;
}

/**
 * 分页响应包装结构。
 */
export interface PaginatedResponseDto<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/**
 * 版本详情结构。
 */
export interface PackageVersionDto {
  version: string;
  deprecated?: string;
}

/**
 * dist-tags 查询结果。
 */
export interface DistTagsDto {
  packageName: string;
  tags: Record<string, string>;
}

/**
 * 登录请求，支持“用户名+token”或“仅token”模式。
 */
export interface LoginRequestDto {
  username?: string;
  token: string;
}

/**
 * 当前会话信息。
 */
export interface SessionUserDto {
  username: string;
  tokenMasked: string;
}

/**
 * 标准错误码，前端按该值做稳定的错误提示映射。
 */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VERDACCIO_ERROR"
  | "INTERNAL_ERROR";

/**
 * 标准错误响应。
 */
export interface ApiErrorResponseDto {
  code: ApiErrorCode;
  message: string;
  statusCode: number;
}

/**
 * 审计操作类型。
 */
export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "TAG_UPSERT"
  | "TAG_DELETE"
  | "PACKAGE_DEPRECATE"
  | "VERSION_DELETE";

/**
 * 审计日志条目。
 */
export interface AuditRecordDto {
  id: string;
  action: AuditAction;
  packageName?: string;
  operator: string;
  detail: string;
  createdAt: string;
}

/**
 * 废弃版本请求体。
 */
export interface DeprecateVersionRequestDto {
  version: string;
  message: string;
}
