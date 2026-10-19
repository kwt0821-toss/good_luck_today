import { defineConfig } from "@apps-in-toss/web-framework/config";

import { TOSS_NAV_BG } from "./src/lib/tossTheme";

export default defineConfig({
  appName: "lucky-cat",
  brand: {
    displayName: "행운냥",
    primaryColor: "#6EC8D4",
    icon: "public/icon.svg",
  },
  web: {
    host: "0.0.0.0",
    port: 5173,
    commands: {
      dev: "vite dev",
      build: "vite build",
    },
  },
  navigationBar: {
    withBackButton: false,
    withHomeButton: true,
    withTitle: true,
    transparentBackground: false,
    theme: "dark",
    ...({ backgroundColor: TOSS_NAV_BG } as Record<string, string>),
  },
  permissions: [],
  outdir: "dist",
});
