import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Gitignored reference projects that live alongside the app — not our code.
  globalIgnores(["itbd-lab/**", "interview-coach-main/**"]),
]);

export default eslintConfig;
