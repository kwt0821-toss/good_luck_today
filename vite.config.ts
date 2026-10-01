import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Cursor 포트 미리보기는 localhost가 아닌 Host로 들어올 수 있어요.
    allowedHosts: true,
  },
});
