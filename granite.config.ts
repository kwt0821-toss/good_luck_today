import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "good-luck-today",
  brand: {
    displayName: "럭키캣",
    primaryColor: "#FF5C8A",
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
