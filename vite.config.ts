import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { atelierServer } from "./server/vite.ts";

export default defineConfig({
  plugins: [react(), tailwindcss(), atelierServer()],
  // A fixed port, so saved canvas positions stay with one browser origin.
  // strictPort: fail instead of silently moving when 3200 is taken.
  // cors: no other page, a framed preview included, needs to read anything from this server.
  server: { port: 3200, strictPort: true, cors: false },
  // The page is one part of the package; the command's own code is built beside it (tsconfig.build.json).
  build: { outDir: "dist/app" },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
