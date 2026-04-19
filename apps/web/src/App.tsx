import { Moon, Home, Info, LogIn, PackageSearch, Settings, ShieldCheck, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { HealthBanner } from "./components/HealthBanner";

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "verdaccio-market-theme";

export function App() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [showToolsMenu, setShowToolsMenu] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme = stored ?? (systemPrefersDark ? "dark" : "light");
    setTheme(nextTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  function handleToggleTheme(): void {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  return (
    <div className="app-shell">
      <header className="bg-primary text-primary-foreground">
        <div className="container-main flex h-14 items-center justify-between gap-4">
          <Link to="/packages" className="flex items-center gap-2 text-sm font-semibold">
            <span className="rounded-full bg-white/90 px-2 py-1 text-xs font-black text-primary">V</span>
            Verdaccio Market
          </Link>
          <div className="hidden w-full max-w-xl items-center gap-2 md:flex">
            <PackageSearch className="h-4 w-4 opacity-80" />
            <Input
              placeholder="Search Packages"
              className="border-white/25 bg-white/10 text-white placeholder:text-white/65"
            />
          </div>
          <nav className="flex items-center gap-1">
            <Button as-child variant="ghost" size="icon" className="text-white hover:bg-white/15">
              <NavLink to="/packages">
                <Home className="h-4 w-4" />
              </NavLink>
            </Button>
            <Button as-child variant="ghost" size="icon" className="text-white hover:bg-white/15">
              <NavLink to="/audits">
                <Info className="h-4 w-4" />
              </NavLink>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/15"
              onClick={handleToggleTheme}
              title="切换主题"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/15"
                onClick={() => setShowToolsMenu((prev) => !prev)}
                title="工具菜单"
              >
                <Settings className="h-4 w-4" />
              </Button>
              {showToolsMenu ? (
                <div className="absolute right-0 top-11 z-50 w-64 rounded-lg border border-border bg-card p-3 text-foreground shadow-lg">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">设置</p>
                  <div className="mt-2 space-y-2 text-sm">
                    <button
                      type="button"
                      className="w-full rounded-md border border-border px-2 py-1 text-left hover:bg-muted"
                      onClick={handleToggleTheme}
                    >
                      主题模式：{theme === "dark" ? "深色" : "浅色"}
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-md border border-border px-2 py-1 text-left hover:bg-muted"
                      onClick={() => {
                        window.localStorage.removeItem(THEME_STORAGE_KEY);
                        setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
                      }}
                    >
                      重置为系统主题
                    </button>
                  </div>
                  <p className="mt-4 text-xs font-semibold uppercase text-muted-foreground">帮助</p>
                  <div className="mt-2 space-y-2 text-sm">
                    <a
                      className="block rounded-md border border-border px-2 py-1 hover:bg-muted"
                      href="https://verdaccio.org/docs/what-is-verdaccio/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Verdaccio 使用文档
                    </a>
                    <a
                      className="block rounded-md border border-border px-2 py-1 hover:bg-muted"
                      href="https://docs.npmjs.com/cli/v10/commands/npm-publish"
                      target="_blank"
                      rel="noreferrer"
                    >
                      npm publish 指南
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
            <Button as-child variant="ghost" className="text-white hover:bg-white/15">
              <NavLink to="/login" className="flex items-center gap-2 text-xs uppercase">
                <LogIn className="h-4 w-4" />
                Login
              </NavLink>
            </Button>
          </nav>
        </div>
      </header>
      <div className="container-main pt-4">
        <HealthBanner />
      </div>
      <Outlet />
      <footer className="mt-12 border-t border-border py-6 text-center text-xs text-muted-foreground">
        <div className="container-main flex items-center justify-between">
          <span>Made with Verdaccio inspired UI</span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            Powered by NestJS + React
          </span>
        </div>
      </footer>
    </div>
  );
}
