import { ref, computed, watch, onMounted, onUnmounted, onActivated, onDeactivated } from "vue";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/store/app";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { message } from "ant-design-vue";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import sql from "highlight.js/lib/languages/sql";
import jsonLang from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import bash from "highlight.js/lib/languages/bash";
import yaml from "highlight.js/lib/languages/yaml";
import markdownLang from "highlight.js/lib/languages/markdown";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("java", java);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("json", jsonLang);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("markdown", markdownLang);

const renderer = {
  code({ text, lang }: { text: string; lang?: string | null }) {
    let highlighted: string;
    if (lang && hljs.getLanguage(lang)) {
      highlighted = hljs.highlight(text, { language: lang }).value;
    } else {
      highlighted = hljs.highlightAuto(text).value;
    }
    const langLabel = lang ? `<span class="code-lang-label">${lang}</span>` : "";
    return `<pre>${langLabel}<code class="hljs">${highlighted}</code></pre>`;
  },
};

marked.use({ renderer });

export type DocType = "prd" | "requirements" | "ui" | "design";

type AiChunkEvent = { requestId?: string; chunk: string } | string;
type AiDoneEvent = { requestId?: string; content: string; recordId: string } | string;
type AiValidationEvent = { requestId?: string; stage: string; message: string; missing?: string[]; attempt?: number };

function isIpcError(value: unknown): value is IpcErrorResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "__ipcError" in value &&
    (value as IpcErrorResult).__ipcError === true
  );
}

function createGenerationRequestId(prefix: string): string {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomId}`;
}

export function useAiGenerator(docType: DocType) {
  const { t } = useI18n();
  const appStore = useAppStore();

  const projectName = ref("");
  const userContent = ref("");
  const referenceItems = ref<Array<{ path: string; content: string }>>([]);
  const referenceFiles = computed(() => referenceItems.value.map((x) => x.path));
  const referenceContent = computed(() =>
    referenceItems.value.map((x) => x.content).join("\n\n---\n\n"),
  );

  const referenceProjectPath = ref("");

  const result = ref("");
  const renderedHtml = ref("");
  const generating = ref(false);
  const lastRecordId = ref("");
  const validationLogs = ref<Array<{ stage: string; message: string; missing: string[]; attempt?: number }>>([]);

  const customProviderId = ref("");
  const customOutputPath = ref("");
  const outputFormat = ref<"md" | "docx" | "pdf" | "png" | "jpeg" | "gif" | "svg" | "html">("md");
  const generationImages = ref<Array<{ base64: string; mimeType: string }>>([]);
  const scopeLevel = ref<"project" | "module">("project");

  const projectCacheStatus = ref<"none" | "valid" | "expired" | "analyzing">("none");
  const projectCacheInfo = ref<ProjectCacheInfo | null>(null);
  const analyzingProject = ref(false);

  const DRAFT_KEY = `devtool-draft-${docType}`;

  function saveDraft() {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          projectName: projectName.value,
          userContent: userContent.value,
          customProviderId: customProviderId.value,
          outputFormat: outputFormat.value,
          scopeLevel: scopeLevel.value,
          referenceProjectPath: referenceProjectPath.value,
          customOutputPath: customOutputPath.value,
        }),
      );
    } catch {
      /* ignore quota errors */
    }
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as {
        projectName?: string;
        userContent?: string;
        customProviderId?: string;
        outputFormat?: string;
        scopeLevel?: string;
        referenceProjectPath?: string;
        customOutputPath?: string;
      };
      if (d.projectName) projectName.value = d.projectName;
      if (d.userContent) userContent.value = d.userContent;
      if (d.customProviderId) customProviderId.value = d.customProviderId;
      if (["md", "docx", "pdf", "png", "jpeg", "gif", "svg", "html"].includes(d.outputFormat ?? "")) {
        outputFormat.value = d.outputFormat as typeof outputFormat.value;
      }
      if (d.scopeLevel === "project" || d.scopeLevel === "module") {
        scopeLevel.value = d.scopeLevel;
      }
      if (d.referenceProjectPath) referenceProjectPath.value = d.referenceProjectPath;
      if (d.customOutputPath) customOutputPath.value = d.customOutputPath;
    } catch {
      /* ignore */
    }
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
  }

  let draftTimer: ReturnType<typeof setTimeout> | null = null;
  watch(
    [projectName, userContent, customProviderId, outputFormat, scopeLevel, referenceProjectPath, customOutputPath],
    () => {
      if (draftTimer) clearTimeout(draftTimer);
      draftTimer = setTimeout(saveDraft, 1500);
    },
  );

  const allProviders = computed(() =>
    appStore.config.aiProviders ?? [],
  );

  const availableProviders = computed(() =>
    (appStore.config.aiProviders ?? []).filter((p) => p.enabled && p.apiKey),
  );

  const selectedProvider = computed(() => {
    if (!customProviderId.value) return null;
    return (appStore.config.aiProviders ?? []).find((p) => p.id === customProviderId.value) ?? null;
  });

  const activeProviderLabel = computed(() => {
    if (!customProviderId.value) return t("gen.common.useDefaultAi");
    const found = (appStore.config.aiProviders ?? []).find((p) => p.id === customProviderId.value);
    return found ? found.name : t("gen.common.useDefaultAi");
  });

  async function saveProviderField(providerId: string, field: "apiKey" | "baseUrl" | "model", value: string) {
    const providers = (appStore.config.aiProviders ?? []).map((p) => {
      const plain = { ...p };
      if (p.id === providerId) {
        plain[field] = value;
        plain.enabled = true;
      }
      return plain;
    });
    await appStore.setConfig({
      aiProviders: providers,
      activeProviderId: appStore.config.activeProviderId || providerId,
    });
  }

  let cleanupChunk: (() => void) | null = null;
  let cleanupDone: (() => void) | null = null;
  let cleanupValidation: (() => void) | null = null;
  let activeRequestId: string | null = null;
  let renderRafId: number | null = null;
  let pendingRender = false;

  function renderMarkdown(md: string): void {
    const raw = marked.parse(md) as string;
    renderedHtml.value = DOMPurify.sanitize(raw);
  }

  function throttledRender(): void {
    if (renderRafId !== null) {
      pendingRender = true;
      return;
    }
    renderRafId = requestAnimationFrame(() => {
      renderMarkdown(result.value);
      renderRafId = null;
      if (pendingRender) {
        pendingRender = false;
        throttledRender();
      }
    });
  }

  function setupListeners() {
    const api = window.electronAPI;
    if (!api) return;
    if (cleanupChunk || cleanupDone || cleanupValidation) return;
    cleanupChunk = api.ai.onChunk((event: AiChunkEvent) => {
      const requestId = typeof event === "string" ? undefined : event.requestId;
      if (!activeRequestId || requestId !== activeRequestId) return;
      const chunk = typeof event === "string" ? event : event.chunk;
      result.value += chunk;
      throttledRender();
    });
    cleanupDone = api.ai.onDone((event: AiDoneEvent, legacyRecordId?: string) => {
      const requestId = typeof event === "string" ? undefined : event.requestId;
      if (!activeRequestId || requestId !== activeRequestId) return;
      const fullContent = typeof event === "string" ? event : event.content;
      const recordId = typeof event === "string" ? String(legacyRecordId || "") : event.recordId;
      result.value = fullContent;
      if (renderRafId !== null) {
        cancelAnimationFrame(renderRafId);
        renderRafId = null;
      }
      renderMarkdown(fullContent);
      lastRecordId.value = recordId;
      generating.value = false;
      activeRequestId = null;
      clearDraft();
    });
    cleanupValidation = api.ai.onValidation((event: AiValidationEvent) => {
      if (!activeRequestId || event.requestId !== activeRequestId) return;
      validationLogs.value = [
        ...validationLogs.value,
        {
          stage: event.stage,
          message: event.message,
          missing: Array.isArray(event.missing) ? event.missing : [],
          attempt: event.attempt,
        },
      ];
    });
  }

  function teardownListeners() {
    if (cleanupChunk) window.electronAPI?.ai.offChunk(cleanupChunk);
    if (cleanupDone) window.electronAPI?.ai.offDone(cleanupDone);
    if (cleanupValidation) window.electronAPI?.ai.offValidation(cleanupValidation);
    cleanupChunk = null;
    cleanupDone = null;
    cleanupValidation = null;
  }

  function onKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (!generating.value && userContent.value.trim()) void generate();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
      if (result.value) void saveDocument();
    }
  }

  function getEffectiveProjectPath(): string | undefined {
    return referenceProjectPath.value || appStore.config.projectPath || undefined;
  }

  async function checkProjectCache() {
    const projectPath = getEffectiveProjectPath();
    if (!projectPath) {
      projectCacheStatus.value = "none";
      projectCacheInfo.value = null;
      return;
    }
    try {
      const info = await window.electronAPI.project.getCacheInfo(projectPath);
      if (!info || typeof info !== "object") {
        projectCacheStatus.value = "none";
        projectCacheInfo.value = null;
        return;
      }
      const cacheInfo = info as ProjectCacheInfo;
      projectCacheInfo.value = cacheInfo;
      projectCacheStatus.value = cacheInfo.expired ? "expired" : "valid";
    } catch {
      projectCacheStatus.value = "none";
      projectCacheInfo.value = null;
    }
  }

  async function analyzeProject() {
    const projectPath = getEffectiveProjectPath();
    if (!projectPath) {
      message.warning(t("gen.cache.noProjectPath"));
      return;
    }
    analyzingProject.value = true;
    projectCacheStatus.value = "analyzing";
    try {
      const result = await window.electronAPI.project.analyze(projectPath);
      if (isIpcError(result)) {
        message.error((result as IpcErrorResult).message);
        projectCacheStatus.value = "none";
        return;
      }
      projectCacheStatus.value = "valid";
      await checkProjectCache();
      message.success(t("gen.cache.analyzeSuccess"));
    } catch (err: unknown) {
      projectCacheStatus.value = "none";
      const msg = err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message) : String(err);
      message.error(msg);
    } finally {
      analyzingProject.value = false;
    }
  }

  async function clearProjectCache() {
    const projectPath = getEffectiveProjectPath();
    if (!projectPath) return;
    try {
      await window.electronAPI.project.clearCache(projectPath);
      projectCacheStatus.value = "none";
      projectCacheInfo.value = null;
      message.success(t("gen.cache.cleared"));
    } catch {
      message.error(t("gen.cache.clearFailed"));
    }
  }

  onMounted(() => {
    void appStore.fetchConfig();
    restoreDraft();
    void checkProjectCache();
  });
  onActivated(() => {
    setupListeners();
    window.addEventListener("keydown", onKeydown);
  });
  onDeactivated(() => {
    window.removeEventListener("keydown", onKeydown);
    teardownListeners();
    saveDraft();
  });
  onUnmounted(() => {
    if (draftTimer) {
      clearTimeout(draftTimer);
      draftTimer = null;
    }
    window.removeEventListener("keydown", onKeydown);
    teardownListeners();
  });

  function removeReferenceFile(filePath: string) {
    referenceItems.value = referenceItems.value.filter((x) => x.path !== filePath);
  }

  async function addReference() {
    const filePath = await window.electronAPI.app.selectFile();
    if (isIpcError(filePath) || !filePath || typeof filePath !== "string") {
      if (isIpcError(filePath)) {
        message.error(filePath.message);
      }
      return;
    }
    if (referenceItems.value.some((x) => x.path === filePath)) {
      message.warning(t("gen.common.docAlreadyInList"));
      return;
    }
    const parsed = await window.electronAPI.app.parseDocument(filePath);
    if (isIpcError(parsed)) {
      message.error(parsed.message);
      return;
    }
    if (parsed && typeof parsed === "object" && "content" in parsed) {
      const content = String((parsed as { content: string }).content);
      referenceItems.value = [...referenceItems.value, { path: filePath, content }];
      message.success(t("gen.common.referenceLoaded"));
    }
  }

  async function addReferenceFolder() {
    const dirPath = await window.electronAPI.app.selectDirectory(t("gen.common.selectRefFolder"));
    if (isIpcError(dirPath) || !dirPath || typeof dirPath !== "string") {
      if (isIpcError(dirPath)) message.error(dirPath.message);
      return;
    }
    if (referenceItems.value.some((x) => x.path === dirPath)) {
      message.warning(t("gen.common.docAlreadyInList"));
      return;
    }
    referenceItems.value = [...referenceItems.value, { path: dirPath, content: `[文件夹] ${dirPath}` }];
    message.success(t("gen.common.referenceFolderAdded"));
  }

  async function selectReferenceProject() {
    const dirPath = await window.electronAPI.app.selectDirectory(t("gen.common.selectRefProject"));
    if (isIpcError(dirPath) || !dirPath || typeof dirPath !== "string") {
      if (isIpcError(dirPath)) message.error(dirPath.message);
      return;
    }
    referenceProjectPath.value = dirPath;
    const info = await window.electronAPI.project.getCacheInfo(dirPath).catch(() => null);
    if (!info || typeof info !== "object" || !("expired" in info) || (info as ProjectCacheInfo).expired) {
      void analyzeProject();
    } else {
      await checkProjectCache();
    }
  }

  async function stopGenerate() {
    try {
      await window.electronAPI.ai.stopGenerate();
    } catch {
      /* ignore */
    }
    generating.value = false;
    activeRequestId = null;
  }

  async function generate() {
    if (!userContent.value.trim()) {
      message.warning(t("gen.common.contentPlaceholder"));
      return;
    }
    if (scopeLevel.value === "module") {
      if (docType === "design" && (!referenceItems.value.length || !referenceProjectPath.value)) {
        message.warning(t("gen.common.needRefAndProject"));
        return;
      }
      if (docType !== "design" && !referenceItems.value.length && !referenceProjectPath.value) {
        message.warning(t("gen.common.needRefOrProject"));
        return;
      }
    }
    generating.value = true;
    activeRequestId = createGenerationRequestId(docType);
    result.value = "";
    renderedHtml.value = "";
    validationLogs.value = [];
    teardownListeners();
    setupListeners();
    try {
      const isZh = t("app.name") !== "Dev Efficiency Tool";
      let finalContent = userContent.value;
      if (scopeLevel.value === "module") {
        finalContent = isZh
          ? `【模块级别需求】以下描述的是系统中某个模块的需求，请基于项目分析结果，明确该模块在整个系统中的位置、与其他模块的依赖关系、共用的基础设施和接口，然后再进行输出。\n\n${finalContent}`
          : `[Module Level] The following describes requirements for a module within the system. Based on the project analysis, clarify the module's position, dependencies, and shared infrastructure before generating output.\n\n${finalContent}`;
      }
      if (!isZh) {
        finalContent += "\n\n[Please respond in English.]";
      }
      const res = await window.electronAPI.ai.generate({
        requestId: activeRequestId,
        docType,
        projectName: projectName.value,
        userContent: finalContent,
        referenceContent: referenceContent.value,
        providerId: customProviderId.value || undefined,
        projectPath: referenceProjectPath.value || appStore.config.projectPath || undefined,
        isModuleScope: scopeLevel.value === "module",
        images: generationImages.value.length ? generationImages.value : undefined,
      });
      if (isIpcError(res)) {
        generating.value = false;
        activeRequestId = null;
        message.error((res as IpcErrorResult).message);
      }
    } catch (err: unknown) {
      generating.value = false;
      activeRequestId = null;
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : String(err);
      message.error(msg);
    }
  }

  async function saveDocument() {
    if (!result.value) return;
    const outputDir = customOutputPath.value || appStore.config.outputPath || (await selectOutputDir());
    if (!outputDir) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const ext = outputFormat.value;
    const fileName = `${docType}-${timestamp}.${ext}`;
    try {
      const savedPath = await window.electronAPI.ai.saveDocument({
        outputDir,
        fileName,
        content: result.value,
        historyRecordId: lastRecordId.value,
        format: ext,
      });
      if (savedPath && typeof savedPath === "object" && isIpcError(savedPath)) {
        if (/trusted paths|可信路径/.test(savedPath.message)) {
          customOutputPath.value = "";
          message.warning(t("gen.common.outputPathUntrusted"));
        }
        message.error(savedPath.message);
      } else {
        message.success(t("gen.common.saveSuccess"));
      }
    } catch {
      message.error(t("gen.common.saveFail"));
    }
  }

  async function selectOutputDir(): Promise<string | null> {
    const picked = await window.electronAPI.app.selectDirectory(t("gen.common.selectOutputDir"));
    if (isIpcError(picked)) {
      message.error(picked.message);
      return null;
    }
    return typeof picked === "string" ? picked : null;
  }

  function copyResult() {
    if (!result.value) return;
    void navigator.clipboard.writeText(result.value);
    message.success(t("common.copied"));
  }

  const contextMenuVisible = ref(false);
  const contextMenuPos = ref({ x: 0, y: 0 });

  function onPreviewContextMenu(e: MouseEvent) {
    if (!result.value) return;
    e.preventDefault();
    contextMenuPos.value = { x: e.clientX, y: e.clientY };
    contextMenuVisible.value = true;
    const hide = () => { contextMenuVisible.value = false; document.removeEventListener("click", hide); };
    setTimeout(() => document.addEventListener("click", hide), 0);
  }

  function copyHtml() {
    if (!renderedHtml.value) return;
    void navigator.clipboard.writeText(renderedHtml.value);
    message.success(t("common.copied"));
    contextMenuVisible.value = false;
  }

  function importFromPreviousResult() {
    const prev = appStore.lastGenResult;
    if (prev) {
      userContent.value = prev;
      message.success(t("gen.common.importPrev"));
    } else {
      message.info(t("gen.common.noResult"));
    }
  }

  function setResultForNextStep() {
    appStore.lastGenResult = result.value;
    appStore.lastGenType = docType;
    message.success(t("gen.common.importNextStepOk"));
  }

  return {
    projectName,
    userContent,
    referenceContent,
    referenceFiles,
    referenceItems,
    result,
    renderedHtml,
    generating,
    lastRecordId,
    validationLogs,
    customProviderId,
    customOutputPath,
    outputFormat,
    generationImages,
    allProviders,
    availableProviders,
    selectedProvider,
    activeProviderLabel,
    projectCacheStatus,
    projectCacheInfo,
    analyzingProject,
    referenceProjectPath,
    scopeLevel,
    stopGenerate,
    addReference,
    addReferenceFolder,
    selectReferenceProject,
    removeReferenceFile,
    generate,
    saveDocument,
    copyResult,
    importFromPreviousResult,
    setResultForNextStep,
    selectOutputDir,
    saveProviderField,
    clearDraft,
    contextMenuVisible,
    contextMenuPos,
    onPreviewContextMenu,
    copyHtml,
    checkProjectCache,
    analyzeProject,
    clearProjectCache,
    teardownListeners,
    setupListeners,
  };
}
