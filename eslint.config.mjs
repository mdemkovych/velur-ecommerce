import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Type-aware linting, which costs a slower `npm run lint` and buys the one
    // class of bug neither `tsc` nor an untyped lint reports.
    // NOTE: (§1.6) A missing `await` on serverless is a write that never lands.
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        // React event handlers are legitimately `() => Promise<void>`; the
        // checked-condition and spread cases are the ones that bite.
        { checksVoidReturn: false },
      ],
      "@typescript-eslint/await-thenable": "error",
    },
  },
  {
    /*
     * `node:test` exposes `test()` and `describe()` as promise-returning
     * functions and awaits them itself, so every call in a test file trips
     * `no-floating-promises`.
     *
     * MUST NOT: switch this off anywhere but test files. It is the rule that
     * catches an unawaited write in a route handler (§1.6).
     */
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: { "@typescript-eslint/no-floating-promises": "off" },
  },
  {
    rules: {
      // `const { secret: _secret, ...rest } = obj` is our idiom for dropping a
      // field before it leaves the server; the binding is intentionally unused.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // `.next/**` above is anchored to the repository root, which holds only
    // until a second checkout appears inside it and builds.
    "**/.next/**",
  ]),
]);

export default eslintConfig;
