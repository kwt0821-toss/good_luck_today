import { defineConfig } from "@apps-in-toss/web-framework/config";

import { TOSS_NAV_BG } from "./src/lib/tossTheme";

export default defineConfig({
  appName: "lucky-cat",
  brand: {
    displayName: "행운냥",
    primaryColor: "#6EC8D4",
    icon: "public/icon.svg",
  },
  /**
   * Opaque title bar — webview content starts below it.
   * @see https://developers-apps-in-toss.toss.im/documentation/common/navigationbar
   */
  navigationBar: {
    withBackButton: false,
    withHomeButton: true,
    withTitle: true,
    transparentBackground: false,
    theme: "dark",
    // backgroundColor is applied at runtime via NavigationBar.setOptions
    // (config typings omit it; same value as TOSS_NAV_BG).
    ...({ backgroundColor: TOSS_NAV_BG } as Record<string, string>),
  },
  webBundleDir: "dist",
  permissions: [],
});
