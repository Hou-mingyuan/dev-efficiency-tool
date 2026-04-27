import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import Components from "unplugin-vue-components/vite";
import { AntDesignVueResolver } from "unplugin-vue-components/resolvers";
import path from "node:path";

export default defineConfig({
  plugins: [
    vue(),
    Components({
      resolvers: [AntDesignVueResolver({ importStyle: false })],
      dts: "src/components.d.ts",
    }),
    electron([
      {
        entry: "electron/main.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            rollupOptions: { external: ["electron", "electron-updater"] },
          },
        },
      },
      {
        entry: "electron/preload.ts",
        onstart(args) {
          args.reload();
        },
        vite: {
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              external: ["electron"],
              output: {
                format: "cjs",
                entryFileNames: "preload.js",
              },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          "ant-design": ["ant-design-vue", "@ant-design/icons-vue", "@ant-design/colors"],
          vendor: ["vue", "vue-router", "pinia", "vue-i18n"],
          markdown: ["marked", "dompurify"],
        },
      },
    },
  },
});
