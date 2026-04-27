import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  { path: "/", name: "Dashboard", component: () => import("../views/Dashboard.vue") },
  { path: "/settings", name: "Settings", component: () => import("../views/Settings.vue") },
  { path: "/health", name: "HealthCheck", component: () => import("../views/HealthCheck.vue") },
  { path: "/logs", name: "LogViewer", component: () => import("../views/LogViewer.vue") },
  { path: "/gen/prd", name: "GeneratePRD", component: () => import("../views/GeneratePRD.vue") },
  { path: "/gen/requirements", name: "GenerateRequirements", component: () => import("../views/GenerateRequirements.vue") },
  { path: "/gen/ui", name: "GenerateUI", component: () => import("../views/GenerateUI.vue") },
  { path: "/gen/design", name: "GenerateDesign", component: () => import("../views/GenerateDesign.vue") },
  { path: "/welcome", name: "Welcome", component: () => import("../views/Welcome.vue"), meta: { fullscreen: true } },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

export function prefetchCriticalRoutes(): void {
  void import("../views/Dashboard.vue");
  void import("../views/Settings.vue");
}

export default router;
