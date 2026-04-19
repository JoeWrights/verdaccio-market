import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { App } from "./App";
import { AuditPage } from "./pages/AuditPage";
import { LoginPage } from "./pages/LoginPage";
import { PackageDetailPage } from "./pages/PackageDetailPage";
import { PackagesPage } from "./pages/PackagesPage";
import "./styles.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root 容器不存在");
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Navigate to="/packages" replace />
      },
      {
        path: "packages",
        element: <PackagesPage />
      },
      {
        path: "packages/:packageName",
        element: <PackageDetailPage />
      },
      {
        path: "audits",
        element: <AuditPage />
      },
      {
        path: "login",
        element: <LoginPage />
      }
    ]
  }
]);

createRoot(container).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
