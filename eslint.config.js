import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  // ── Ignored paths ───────────────────────────────────────────────────────────
  {
    ignores: ["dist/**", "android/**", "node_modules/**"],
  },

  // ── TypeScript + React source files ─────────────────────────────────────────
  {
    files: ["src/**/*.{ts,tsx}", "backend/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
    },
    rules: {
      // TypeScript recommended
      ...tsPlugin.configs.recommended.rules,
      // React Hooks — only the two well-established rules; v7 recommended
      // adds aggressive new rules (purity, set-state-in-effect, etc.) that
      // produce false positives on event handlers and existing patterns
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Project overrides
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },

  // ── Prettier — must be last to override formatting rules ────────────────────
  prettier,
];
