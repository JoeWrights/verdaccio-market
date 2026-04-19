import { FormEvent, useState } from "react";
import { deleteDistTag, upsertDistTag } from "../api/tags";
import type { ApiClientError } from "../api/client";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

interface DistTagsEditorProps {
  packageName: string;
  tags: Record<string, string>;
  canEdit: boolean;
  onChanged: () => Promise<void>;
}

export function DistTagsEditor(props: DistTagsEditorProps) {
  const [tagName, setTagName] = useState("latest");
  const [version, setVersion] = useState("");
  const [error, setError] = useState("");

  async function handleUpsert(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError("");
    try {
      await upsertDistTag({
        packageName: props.packageName,
        tagName,
        version
      });
      await props.onChanged();
    } catch (err) {
      const apiError = err as ApiClientError;
      setError(apiError.message);
    }
  }

  async function handleDelete(currentTag: string): Promise<void> {
    setError("");
    try {
      await deleteDistTag({
        packageName: props.packageName,
        tagName: currentTag
      });
      await props.onChanged();
    } catch (err) {
      const apiError = err as ApiClientError;
      setError(apiError.message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>dist-tags</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {Object.entries(props.tags).map(([name, value]) => (
            <div key={name} className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1 text-sm">
              <Badge variant="outline">{name}</Badge>
              <span className="text-muted-foreground">{value}</span>
              {props.canEdit ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => handleDelete(name)}>
                  删除
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        {props.canEdit ? (
          <form className="grid grid-cols-1 gap-2 md:grid-cols-3" onSubmit={handleUpsert}>
            <Input value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="tag 名称" />
            <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="版本号" />
            <Button type="submit">更新标签</Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">登录后可管理 dist-tags。</p>
        )}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
