import { apiClient } from "./client";

export async function deprecateVersion(params: {
  packageName: string;
  version: string;
  message: string;
}): Promise<void> {
  await apiClient.post(`/packages/${encodeURIComponent(params.packageName)}/deprecate`, {
    version: params.version,
    message: params.message
  });
}

export async function deleteVersion(params: { packageName: string; version: string }): Promise<void> {
  await apiClient.delete(
    `/packages/${encodeURIComponent(params.packageName)}/versions/${encodeURIComponent(params.version)}`
  );
}
