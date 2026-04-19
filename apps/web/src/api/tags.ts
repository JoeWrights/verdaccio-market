import { apiClient } from "./client";

export async function upsertDistTag(params: {
  packageName: string;
  tagName: string;
  version: string;
}): Promise<void> {
  await apiClient.put(
    `/packages/${encodeURIComponent(params.packageName)}/dist-tags/${encodeURIComponent(params.tagName)}`,
    {
      version: params.version
    }
  );
}

export async function deleteDistTag(params: { packageName: string; tagName: string }): Promise<void> {
  await apiClient.delete(
    `/packages/${encodeURIComponent(params.packageName)}/dist-tags/${encodeURIComponent(params.tagName)}`
  );
}
