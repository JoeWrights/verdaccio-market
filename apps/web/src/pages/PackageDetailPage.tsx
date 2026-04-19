import { useEffect, useState } from "react";
import type { DistTagsDto, PackageDetailDto, PackageVersionDto, SessionUserDto } from "@verdaccio-market/types";
import { Copy, Home, ShieldCheck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { DistTagsEditor } from "../components/DistTagsEditor";
import { MarkdownPreview } from "../components/MarkdownPreview";
import { getCurrentUser } from "../api/auth";
import type { ApiClientError } from "../api/client";
import { getDistTags, getPackageDetail, getPackageVersions } from "../api/packages";
import { deleteVersion, deprecateVersion } from "../api/publish-admin";
import { Avatar } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

export function PackageDetailPage() {
  const params = useParams<{ packageName: string }>();
  const packageName = decodeURIComponent(params.packageName ?? "");
  const [detail, setDetail] = useState<PackageDetailDto | null>(null);
  const [versions, setVersions] = useState<PackageVersionDto[]>([]);
  const [distTags, setDistTags] = useState<DistTagsDto | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUserDto | null>(null);
  const [error, setError] = useState("");
  const [deprecateMessage, setDeprecateMessage] = useState("该版本已废弃，请升级。");

  async function refresh(): Promise<void> {
    if (!packageName) {
      return;
    }
    const [detailData, versionData, tagsData] = await Promise.all([
      getPackageDetail(packageName),
      getPackageVersions(packageName),
      getDistTags(packageName)
    ]);
    setDetail(detailData);
    setVersions(versionData);
    setDistTags(tagsData);
  }

  useEffect(() => {
    refresh().catch((err: ApiClientError) => setError(err.message));
    getCurrentUser()
      .then(setCurrentUser)
      .catch(() => setCurrentUser(null));
  }, [packageName]);

  if (error) {
    return (
      <main className="container-main py-6">
        <p className="text-sm text-red-600">{error}</p>
        <Link to="/packages" className="text-sm text-primary underline">
          返回包列表
        </Link>
      </main>
    );
  }

  if (!detail || !distTags) {
    return (
      <main className="container-main py-6">
        <p className="text-sm text-muted-foreground">加载中...</p>
      </main>
    );
  }

  return (
    <main className="container-main py-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-4xl font-bold">{detail.name}</CardTitle>
              <CardDescription>{detail.description || "暂无描述"}</CardDescription>
              <div className="flex flex-wrap gap-2">
                <Badge>latest: {detail.latestVersion}</Badge>
                <Badge variant="outline">MIT</Badge>
                <Badge variant="outline">Verdaccio</Badge>
              </div>
            </CardHeader>
          </Card>

          <Tabs defaultValue="readme">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="readme">README</TabsTrigger>
              <TabsTrigger value="versions">VERSIONS</TabsTrigger>
              <TabsTrigger value="tags">DIST-TAGS</TabsTrigger>
            </TabsList>
            <TabsContent value="readme">
              <Card>
                <CardContent className="readme-content pt-5">
                  <MarkdownPreview content={detail.readme || "暂无 README 内容"} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="versions">
              <Card>
                <CardHeader>
                  <CardTitle>版本管理</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {versions.map((item) => (
                    <div key={item.version} className="flex flex-col gap-2 rounded-md border border-border p-3 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{item.version}</div>
                        {item.deprecated ? (
                          <p className="text-xs text-amber-700">已废弃：{item.deprecated}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">状态：可用</p>
                        )}
                      </div>
                      {currentUser ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              deprecateVersion({
                                packageName: detail.name,
                                version: item.version,
                                message: deprecateMessage
                              })
                                .then(() => refresh())
                                .catch((err: ApiClientError) => setError(err.message))
                            }
                          >
                            废弃
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              deleteVersion({
                                packageName: detail.name,
                                version: item.version
                              })
                                .then(() => refresh())
                                .catch((err: ApiClientError) => setError(err.message))
                            }
                          >
                            删除版本
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {currentUser ? (
                    <Input
                      value={deprecateMessage}
                      onChange={(event) => setDeprecateMessage(event.target.value)}
                      placeholder="废弃说明"
                    />
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="tags">
              <DistTagsEditor
                packageName={detail.name}
                tags={distTags.tags}
                canEdit={Boolean(currentUser)}
                onChanged={refresh}
              />
            </TabsContent>
          </Tabs>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-lg">@{detail.name}</CardTitle>
            <CardDescription>Latest {detail.latestVersion}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium">快捷操作</p>
              <div className="flex gap-2">
                <Button size="icon" variant="outline">
                  <Home className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline">
                  <ShieldCheck className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Installation</p>
              <InstallLine text={`npm i ${detail.name}@${detail.latestVersion}`} />
              <InstallLine text={`yarn add ${detail.name}@${detail.latestVersion}`} />
              <InstallLine text={`pnpm add ${detail.name}@${detail.latestVersion}`} />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Keywords</p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(distTags.tags).map((key) => (
                  <Badge variant="outline" key={key}>
                    {key}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Author</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Avatar>A</Avatar>
                Anonymous
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function InstallLine(props: { text: string }) {
  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(props.text);
  }

  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
      <code>{props.text}</code>
      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={handleCopy}>
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
