import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "good-luck-today",
  brand: {
    displayName: "오늘의 행운",
    primaryColor: "#12B886",
    icon: "",
  },
  web: {
    host: "localhost",
    port: 5173,
    commands: {
      dev: "vite dev",
      build: "vite build",
    },
  },
  permissions: [],
  outdir: "dist",
});
