import fs from "node:fs";
import path from "node:path";
import type { Connect } from "vite";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const IMAGE_CACHE = "public, max-age=31536000, immutable";

/** Versioned images (?v=) can be cached for a year. */
function imageCachePlugin(): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.url ?? "";
    if (/[?&]v=/.test(url) && /\.(webp|png|jpe?g|gif|avif|svg|woff2)(\?|$)/i.test(url)) {
      res.setHeader("Cache-Control", IMAGE_CACHE);
    }
    next();
  };
  return {
    name: "image-cache",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

/**
 * ait packs `dist` as static files and does not rewrite unknown paths.
 * `/dex` and `/rewards` each get their own index.html so a directory host
 * can open the app instead of returning 404.
 */
function promoEntryPages(): Plugin {
  return {
    name: "promo-entry-pages",
    apply: "build",
    closeBundle() {
      const dist = path.resolve("dist");
      const indexPath = path.join(dist, "index.html");
      if (!fs.existsSync(indexPath)) return;
      for (const route of ["dex", "rewards"]) {
        const dir = path.join(dist, route);
        fs.mkdirSync(dir, { recursive: true });
        fs.copyFileSync(indexPath, path.join(dir, "index.html"));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), imageCachePlugin(), promoEntryPages()],
  build: {
    target: ["es2020", "safari14"],
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    cors: true,
    hmr: {
      overlay: false,
    },
  },
});
