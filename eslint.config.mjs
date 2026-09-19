import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // ESLint walks the filesystem, not git, so .gitignore does not cover this.
    // The replaced Vite app can still be present in a working copy, and
    // linting its minified bundle fails the build on rules that only make
    // sense for source we wrote.
    "frontend/**",
  ]),
]);

export default eslintConfig;
