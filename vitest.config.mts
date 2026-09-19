import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": `${root}src`,
      "server-only": `${root}tests/serverOnly.ts`,
    },
  },
  // The Next tsconfig uses `jsx: "preserve"`, which the transformer will not
  // act on. Vitest 5 transforms with oxc, so the setting goes here — an
  // `esbuild` block is accepted and then ignored. This is what lets component
  // tests run without pulling in a Vite React plugin.
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "react",
    },
  },
  test: {
    // Node by default: most of the suite is server-side. Component tests opt in
    // per file with `// @vitest-environment jsdom`.
    environment: "node",
    clearMocks: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
