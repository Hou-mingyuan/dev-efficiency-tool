import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import i18n from "./i18n";
import "ant-design-vue/dist/reset.css";
import "./styles/global.less";

const app = createApp(App);
const RECENT_ERROR_TTL_MS = 3000;
const RECENT_ERROR_LIMIT = 100;
const recentErrorReports = new Map<string, number>();

function normalizeErrorPayload(err: unknown, source: string) {
  if (err instanceof Error) {
    return {
      level: "error" as const,
      source,
      message: err.message,
      stack: err.stack,
      url: window.location.href,
    };
  }
  let message: string;
  try {
    message = typeof err === "string" ? err : JSON.stringify(err);
  } catch {
    message = String(err);
  }
  return {
    level: "error" as const,
    source,
    message,
    url: window.location.href,
  };
}

function errorReportKey(payload: Parameters<ElectronAPI["app"]["logRendererError"]>[0]): string {
  if (!payload || typeof payload !== "object") return String(payload);
  const p = payload as {
    level?: string;
    source?: string;
    message?: string;
    url?: string;
    line?: number;
    column?: number;
  };
  return [
    p.level || "",
    p.source || "",
    p.message || "",
    p.url || "",
    p.line ?? "",
    p.column ?? "",
  ].join("|").slice(0, 1000);
}

function reportRendererError(payload: Parameters<ElectronAPI["app"]["logRendererError"]>[0]) {
  try {
    const now = Date.now();
    const key = errorReportKey(payload);
    const previous = recentErrorReports.get(key);
    if (previous && now - previous < RECENT_ERROR_TTL_MS) return;
    recentErrorReports.set(key, now);
    if (recentErrorReports.size > RECENT_ERROR_LIMIT) {
      for (const [oldKey, reportedAt] of recentErrorReports) {
        if (now - reportedAt > RECENT_ERROR_TTL_MS) {
          recentErrorReports.delete(oldKey);
        }
      }
      while (recentErrorReports.size > RECENT_ERROR_LIMIT) {
        const first = recentErrorReports.keys().next().value;
        if (!first) break;
        recentErrorReports.delete(first);
      }
    }
    void window.electronAPI?.app?.logRendererError(payload);
  } catch {
    /* ignore logging failures */
  }
}

function componentName(instance: unknown): string {
  if (!instance || typeof instance !== "object") return "unknown";
  const maybe = instance as { $options?: { name?: string } };
  return maybe.$options?.name || "unknown";
}

app.config.errorHandler = (err, instance, info) => {
  reportRendererError({
    ...normalizeErrorPayload(err, "vue"),
    message: `${err instanceof Error ? err.message : String(err)}\ninfo=${info}\ncomponent=${componentName(instance)}`,
  });
};

app.config.warnHandler = (msg, instance, trace) => {
  reportRendererError({
    level: "warn",
    source: "vue",
    message: `${msg}\ntrace=${trace}\ncomponent=${componentName(instance)}`,
    url: window.location.href,
  });
};

window.addEventListener("error", (event) => {
  reportRendererError({
    ...normalizeErrorPayload(event.error || event.message, "window-error"),
    message: event.message,
    stack: event.error instanceof Error ? event.error.stack : undefined,
    url: event.filename || window.location.href,
    line: event.lineno,
    column: event.colno,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  reportRendererError(normalizeErrorPayload(event.reason, "unhandled-rejection"));
});

app.use(createPinia());
app.use(router);
app.use(i18n);
app.mount("#app");

window.addEventListener("load", () => {
  window.setTimeout(() => {
    const splash = document.getElementById("splash");
    if (!splash) return;
    splash.classList.add("hide");
    window.setTimeout(() => splash.remove(), 600);
  }, 300);
});
