import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // A fixed port, so saved canvas positions stay with one browser origin.
  // strictPort: fail instead of silently moving when 3200 is taken.
  server: { port: 3200, strictPort: true },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
