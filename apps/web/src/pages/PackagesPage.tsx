import { FormEvent, useEffect, useState } from "react";
import type { PaginatedResponseDto, PackageSummaryDto } from "@verdaccio-market/types";
import { Clock3, Columns2, List, Package, UserCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { listPrivatePackages, listRecentPackages, searchPackages } from "../api/packages";
import type { ApiClientError } from "../api/client";
import { cn } from "../lib/utils";

export function PackagesPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedResponseDto<PackageSummaryDto> | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"search" | "private">("search");
  const [viewMode, setViewMode] = useState<"single" | "double">("single");

  async function loadData(targetPage: number): Promise<void> {
    setError("");
    const trimmedQuery = query.trim();
    const data = await (async () => {
      if (mode === "private") {
        return listPrivatePackages({
          page: targetPage,
          pageSize: 10
        });
      }
      if (!trimmedQuery) {
        return listRecentPackages({
          page: targetPage,
          pageSize: 10
        });
      }
      return searchPackages({
        query: trimmedQuery,
        page: targetPage,
        pageSize: 10
      });
    })();
    setResult(data);
    setPage(targetPage);
  }

  useEffect(() => {
    if (mode === "private") {
      void loadData(1);
    } else {
      void loadData(1);
    }
  }, [mode]);

  async function handleSearch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    try {
      await loadData(1);
    } catch (err) {
      const apiError = err as ApiClientError;
      setError(apiError.message);
    }
  }

  function getVisiblePages(totalPages: number, currentPage: number): number[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);
    for (let pageNum = currentPage - 2; pageNum <= currentPage + 2; pageNum += 1) {
      if (pageNum > 1 && pageNum < totalPages) {
        pages.add(pageNum);
      }
    }
    return Array.from(pages).sort((a, b) => a - b);
  }

  return (
    <main className="container-main py-6">
      <Card>
        <CardHeader>
          <CardTitle>Packages</CardTitle>
          <CardDescription>参考 Verdaccio 与 npmjs 的列表信息结构，支持分页检索。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={mode === "search" ? "default" : "outline"}
                onClick={() => setMode("search")}
              >
                搜索模式
              </Button>
              <Button
                type="button"
                variant={mode === "private" ? "default" : "outline"}
                onClick={() => setMode("private")}
              >
                私服 npm 包展示模式
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={viewMode === "single" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("single")}
                title="单列展示"
              >
                <List className="mr-1 h-4 w-4" />
                单列
              </Button>
              <Button
                type="button"
                variant={viewMode === "double" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("double")}
                title="双列展示"
              >
                <Columns2 className="mr-1 h-4 w-4" />
                双列
              </Button>
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search package name" />
            <Button type="submit" disabled={mode === "private"}>
              Search
            </Button>
          </form>
          {mode === "private" ? (
            <p className="text-xs text-muted-foreground">已切换私服模式：展示 Verdaccio 本地已发布包。</p>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {!result ? <p className="text-sm text-muted-foreground">加载中...</p> : null}

          {result ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                共 {result.total} 条结果，当前第 {result.page} 页
              </p>
              <div
                className={cn(
                  "gap-3",
                  viewMode === "single" ? "grid grid-cols-1" : "grid grid-cols-1 lg:grid-cols-2"
                )}
              >
                {result.items.map((item) => (
                  <Card key={item.name} className="border-l-4 border-l-primary/80">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        <Link className="hover:underline" to={`/packages/${encodeURIComponent(item.name)}`}>
                          {item.name}
                        </Link>
                      </CardTitle>
                      <CardDescription>{item.description || "No description provided."}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-0">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">v{item.latestVersion}</Badge>
                        <Badge>{item.versionCount} versions</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <UserCircle2 className="h-3.5 w-3.5" />
                          Anonymous
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {item.updatedAt
                            ? `Updated ${new Date(item.updatedAt).toLocaleString()}`
                            : "Recently updated"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Package className="h-3.5 w-3.5" />
                          Verdaccio Registry
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" disabled={page <= 1} onClick={() => void loadData(page - 1)}>
                  上一页
                </Button>
                {(() => {
                  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
                  const visiblePages = getVisiblePages(totalPages, page);
                  return visiblePages.map((pageNum, index) => {
                    const prevPage = visiblePages[index - 1];
                    const needLeftEllipsis = prevPage && pageNum - prevPage > 1;
                    return (
                      <span key={`page-wrap-${pageNum}`} className="inline-flex items-center gap-2">
                        {needLeftEllipsis ? <span className="text-sm text-muted-foreground">...</span> : null}
                        <Button
                          type="button"
                          size="sm"
                          variant={pageNum === page ? "default" : "outline"}
                          onClick={() => void loadData(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      </span>
                    );
                  });
                })()}
                <Button
                  type="button"
                  variant="outline"
                  disabled={result.page * result.pageSize >= result.total}
                  onClick={() => void loadData(page + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
