/// <reference types="vitest" />
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// The Client version identity is read from the repository's single source of
// truth at config load. A missing or malformed file fails the build instead of
// compiling a bundle that cannot state its version.
function readClientVersion(): number {
  const file = new URL("./client-version.json", import.meta.url);
  let source: string;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    throw new Error("client-version.json is missing or unreadable at the repository root");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("client-version.json must be valid JSON");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("client-version.json must contain a JSON object");
  }

  const version = (parsed as Record<string, unknown>).client_version;
  if ((parsed as Record<string, unknown>).schema_version !== 1) {
    throw new Error("client-version.json schema_version must be 1");
  }
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 0) {
    throw new Error("client-version.json client_version must be a non-negative safe integer");
  }
  return version;
}

const clientVersion = readClientVersion();

// https://vite.dev/config/
export default defineConfig(async () => ({
  // The Client version is compiled in once, from client-version.json.
  define: {
    __CLIENT_VERSION__: JSON.stringify(clientVersion),
  },

  plugins: [react(), tailwindcss()],

  test: {
    environment: "jsdom",
    exclude: ["browser/**", "node_modules/**"],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
