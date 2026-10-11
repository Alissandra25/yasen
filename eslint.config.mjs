// ESLint flat config (Next.js 16+, ESLint 9+).
// Project rules live here, not in hooks: the format hook just runs ESLint,
// so the same rules apply to Claude's edits, to manual edits and in CI.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import i18next from "eslint-plugin-i18next";
import prettier from "eslint-config-prettier/flat";

const MONEY_PARSE =
  "Never parse money with parseFloat: parseFloat('105,50') === 105. Use parseMoney() from src/lib/money.ts.";
const MONEY_FORMAT =
  "Don't format with toFixed: use formatMoney() from src/lib/money.ts, or Intl.NumberFormat for other numbers.";
const NO_HEX =
  "No hard-coded colours: use theme tokens (bg-primary, text-destructive, …). Brand colours come from business settings.";
const DATE_ONLY =
  "Date-only values stay 'YYYY-MM-DD' strings — new Date('2026-10-08') shifts the day in some time zones. Use src/lib/dates.ts.";
const DATA_ACCESS =
  "UI code must not touch the database. Read data through server actions/services in src/server/.";

export default defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    ".next/**",
    "node_modules/**",
    "coverage/**",
    "playwright-report/**",
    "drizzle/**",
    "src/components/ui/**", // shadcn, generated
    "next-env.d.ts",
  ]),

  // Type-aware rules for all TypeScript.
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/consistent-type-imports": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },

  // Project rules: money, dates, colours, dependencies.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": ["error", { name: "parseFloat", message: MONEY_PARSE }],
      "no-restricted-properties": [
        "error",
        { object: "Number", property: "parseFloat", message: MONEY_PARSE },
        { property: "toFixed", message: MONEY_FORMAT },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/\\[#[0-9a-fA-F]{3,8}\\]/]",
          message: NO_HEX,
        },
        {
          selector: "JSXAttribute[name.name='className'] TemplateElement[value.raw=/\\[#[0-9a-fA-F]{3,8}\\]/]",
          message: NO_HEX,
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.0.value=/^\\d{4}-\\d{2}-\\d{2}$/]",
          message: DATE_ONLY,
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react-redux", message: "Use TanStack Query for server data and React state for UI state." },
            { name: "@reduxjs/toolkit", message: "Use TanStack Query for server data and React state for UI state." },
            { name: "moment", message: "Use src/lib/dates.ts." },
          ],
        },
      ],
    },
  },

  // UI layer: no direct database access.
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    ignores: ["src/app/api/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "react-redux", message: "Use TanStack Query for server data and React state for UI state." },
            { name: "@reduxjs/toolkit", message: "Use TanStack Query for server data and React state for UI state." },
            { name: "moment", message: "Use src/lib/dates.ts." },
            { name: "drizzle-orm", message: DATA_ACCESS },
          ],
          patterns: [{ group: ["@/db", "@/db/*", "**/db/schema", "**/db/schema/*"], message: DATA_ACCESS }],
        },
      ],
    },
  },

  // i18n: no literal user-facing strings in JSX.
  {
    files: ["src/app/**/*.tsx", "src/components/**/*.tsx"],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          mode: "jsx-only",
          "jsx-attributes": { include: ["title", "placeholder", "alt", "aria-label", "label"] },
        },
      ],
    },
  },

  // Tests and tooling: relaxed.
  {
    files: ["**/*.test.{ts,tsx}", "tests/**", "e2e/**", "scripts/**"],
    rules: {
      "i18next/no-literal-string": "off",
      "no-restricted-globals": "off",
      "no-restricted-properties": "off",
      "no-restricted-syntax": "off",
    },
  },

  // Must be last: turns off rules that conflict with Prettier.
  prettier,
]);
