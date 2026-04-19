import { useEffect, useState } from "react";
import type { AuditRecordDto } from "@verdaccio-market/types";
import { getAudits } from "../api/audit";
import type { ApiClientError } from "../api/client";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

export function AuditPage() {
  const [records, setRecords] = useState<AuditRecordDto[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getAudits()
      .then(setRecords)
      .catch((err: ApiClientError) => setError(err.message));
  }, []);

  return (
    <main className="container-main py-6">
      <Card>
        <CardHeader>
          <CardTitle>审计日志</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {records.map((item) => (
            <div key={item.id} className="rounded-md border border-border bg-background p-3 text-sm">
              <div className="mb-1 flex items-center gap-2">
                <Badge>{item.action}</Badge>
                <span className="text-muted-foreground">{item.createdAt}</span>
              </div>
              <p>
                操作者：{item.operator} ｜包：{item.packageName ?? "-"}
              </p>
              <p className="text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
