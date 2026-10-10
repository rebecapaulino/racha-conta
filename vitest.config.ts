import { defineConfig } from "vitest/config";

// Testes da lógica de cálculo (src/core), que não dependem de navegador.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
