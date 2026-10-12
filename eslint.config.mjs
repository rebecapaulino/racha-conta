import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // public/ocr: arquivos do Tesseract copiados de node_modules (ver scripts/copy-ocr.mjs).
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/ocr/**"]),
]);
