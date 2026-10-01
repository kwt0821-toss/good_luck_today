import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    // Cursor 포트 미리보기/클라우드 프록시는 localhost가 아닌 Host로 들어와요.
    allowedHosts: true,
  },
});
