import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import type { ApiClientError } from "../api/client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login({ username, token });
      navigate("/packages");
    } catch (err) {
      const apiError = err as ApiClientError;
      setError(apiError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container-main py-6">
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>登录 Verdaccio 市场</CardTitle>
          <CardDescription>请输入 npm token（可选用户名），用于执行受限写操作。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用户名（可选）"
            />
            <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="npm token" />
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "登录中..." : "登录"}
            </Button>
          </form>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
