import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  { path: "/", name: "Dashboard", component: () => import("../views/Dashboard.vue") },
  { path: "/settings", name: "Settings", component: () => import("../views/Settings.vue") },
  { path: "/methodology", name: "Methodology", component: () => import("../views/Methodology.vue") },
  { path: "/ide", name: "IdeManager", component: () => import("../views/IdeManager.vue") },
  { path: "/health", name: "HealthCheck", component: () => import("../views/HealthCheck.vue") },
  { path: "/logs", name: "LogViewer", component: () => import("../views/LogViewer.vue") },
  { path: "/parser", name: "DocumentParser", component: () => import("../views/DocumentParser.vue") },
  { path: "/gen/prd", name: "GeneratePRD", component: () => import("../views/GeneratePRD.vue") },
  { path: "/gen/requirements", name: "GenerateRequirements", component: () => import("../views/GenerateRequirements.vue") },
  { path: "/gen/ui", name: "GenerateUI", component: () => import("../views/GenerateUI.vue") },
  { path: "/gen/design", name: "GenerateDesign", component: () => import("../views/GenerateDesign.vue") },
  { path: "/welcome", name: "Welcome", component: () => import("../views/Welcome.vue") },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

/**
 * Eagerly warm the two most used chunks after shell load.
 */
export function prefetchCriticalRoutes(): void {
  void import("../views/Dashboard.vue");
  void import("../views/Settings.vue");
}

export default router;
