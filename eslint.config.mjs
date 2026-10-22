import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/*
 * Module boundaries for the modular monolith (see docs/ARCHITECTURE.md).
 *
 *   FRONTEND  app/, components/     -> may call server/<domain>/{actions,queries,schema}
 *   BACKEND   server/<domain>/      -> only repository.ts may touch db/
 *   DATABASE  db/                   -> client, schema, migrations, seed
 *
 * Enforced with core `no-restricted-imports` so a violation is a lint error,
 * not a code-review comment. Swap for eslint-plugin-boundaries later if the
 * rules outgrow glob patterns.
 */

const dbAccess = {
  group: ["@/db", "@/db/*", "drizzle-orm", "drizzle-orm/*", "postgres"],
  message:
    "Only server/<domain>/repository.ts may access the database module. Go through the domain's service instead.",
};

const anyRepository = {
  group: ["@/server/*/repository", "**/repository"],
  message:
    "Frontend code must not import repositories. Use server/<domain>/queries (reads) or actions (writes).",
};

const anyService = {
  group: ["@/server/*/service"],
  message:
    "UI enters the backend only through server/<domain>/actions (Server Actions) or queries (Server Component reads). Route handlers under app/api may call services.",
};

const otherDomainRepository = {
  group: ["@/server/*/repository", "../*/repository", "../../*/repository"],
  message:
    "Cross-domain access must go through the other domain's service.ts, never its repository. Import your own repository as './repository'.",
};

const frontendInternals = {
  group: ["@/app/*", "@/components/*"],
  message: "The backend module must not depend on frontend code.",
};

const backendFromLib = {
  group: ["@/server/*", "@/db", "@/db/*", "@/app/*", "@/components/*"],
  message: "lib/ holds framework-agnostic utilities only.",
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },

  // FRONTEND: pages, layouts, components.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [dbAccess, anyRepository, anyService] }],
    },
  },
  // Route handlers are a sanctioned backend entry point: they may call services.
  {
    files: ["app/api/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [dbAccess, anyRepository] }],
    },
  },

  // BACKEND: everything under server/ except repositories.
  {
    files: ["server/**/*.ts"],
    ignores: ["server/**/repository.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [dbAccess, otherDomainRepository, frontendInternals] }],
    },
  },
  // Repositories may use the DB, but still only their own domain's repository.
  {
    files: ["server/**/repository.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [otherDomainRepository, frontendInternals] }],
    },
  },

  // CROSS-CUTTING utilities stay framework- and domain-agnostic.
  {
    files: ["lib/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [backendFromLib] }],
    },
  },

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "Materials/**", "db/migrations/**"]),
]);
