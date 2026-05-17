import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

export default defineConfig({
  plugins: [pluginReact()],
  output: {
    assetPrefix: process.env.PUBLIC_BASE_PATH ?? "/"
  },
  server: {
    port: 5173,
    proxy: {
      // 前端始终调用 BFF，相当于把 Verdaccio 细节封装在后端服务内。
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    }
  }
});
