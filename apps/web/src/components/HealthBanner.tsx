import { useEffect, useState } from "react";
import type { HealthResponseDto } from "@verdaccio-market/types";
import { Badge } from "./ui/badge";
import { fetchHealth } from "../api/market";
import type { ApiClientError } from "../api/client";

export function HealthBanner() {
  const [health, setHealth] = useState<HealthResponseDto | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch((err: ApiClientError) => setError(err.message));
  }, []);

  if (error) {
    return <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">健康检查失败：{error}</p>;
  }

  if (!health) {
    return <p className="text-sm text-muted-foreground">正在加载健康状态...</p>;
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs">
      <Badge variant={health.status === "ok" ? "default" : "outline"}>
        系统状态：{health.status === "ok" ? "正常" : "降级"}
      </Badge>
      <span className="text-muted-foreground">
        缓存条目 {health.cache.size}（命中 {health.cache.hits} / 未命中 {health.cache.misses}）
      </span>
    </div>
  );
}
