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

export default defineConfig({
  plugins: [react(), imageCachePlugin()],
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
