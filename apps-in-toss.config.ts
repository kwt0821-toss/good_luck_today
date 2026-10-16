import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "lucky-cat",
  brand: {
    displayName: "럭키캣",
    primaryColor: "#6EC8D4",
  },
  /**
   * Opaque Toss title bar — webview lays out below it.
   * @see https://developers-apps-in-toss.toss.im/documentation/common/navigationbar
   */
  navigationBar: {
    withBackButton: false,
    withHomeButton: true,
    withTitle: true,
    transparentBackground: false,
    theme: "dark",
  },
  webBundleDir: "dist",
  permissions: [],
});
