import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "..", "");
  const proxy = {
    "/api": { target: `http://127.0.0.1:${env.PORT || 3001}` },
    "/media": { target: `http://127.0.0.1:${env.PORT || 3001}` },
  };
  const port = Number(
    new URL(env.FRONTEND_ORIGIN || "http://localhost:5173").port || 5173,
  );
  return {
    plugins: [react()],
    server: { port, strictPort: true, proxy },
    preview: { proxy },
  };
});
