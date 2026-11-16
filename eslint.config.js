import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["ui/**/*.{ts,tsx}"],
    plugins: {
      "@typescript-eslint": tseslint,
      react,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser, // adds console, window, document, etc.
        ...globals.es2021,
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off", // not needed in modern React
      // No brace-less bodies — `if (x) return;` becomes `if (x) { return; }`.
      // Auto-fixable, so editors wired to eslint's fixAll apply it on save.
      curly: ["error", "all"],
      // Spell the cast out: `Boolean(x)` over `!!x`, and likewise for the
      // `+x` / `"" + x` shorthands. Auto-fixable alongside curly.
      "no-implicit-coercion": "error",
      // Keep the Rust boundary in one module so every crossing reads `rust.*`
      // at its call site. ui/lib/rust.ts is exempted below.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/generated/bindings",
              importNames: ["commands"],
              message:
                'Reach Rust through `import * as rust from "@/lib/rust"` so the call site shows it.',
            },
          ],
          patterns: [
            {
              group: [
                "@tauri-apps/api",
                "@tauri-apps/api/*",
                "@tauri-apps/plugin-*",
              ],
              message:
                "Wrap the Tauri API in @/lib/rust instead of calling it from a component.",
            },
          ],
        },
      ],
    },
  },
  {
    // The boundary module is the one place allowed to touch either directly.
    files: ["ui/lib/rust.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    ignores: ["dist/**", "src-tauri/**", "node_modules/**", "ui/generated"],
  },
];
