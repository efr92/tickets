import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  envDir: "..",
  server: {
    host: true, // чтобы открыть с телефона по IP в локальной сети
    proxy: { "/api": "http://localhost:8000" },
  },
});
