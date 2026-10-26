import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const FRAMEWORKS = ["next", "next/*", "react", "react-dom", "drizzle-orm", "drizzle-orm/*", "pg", "zod"];

/** Clean architecture dependency rule (docs/decisions.md, D2): inner layers never import outer ones. */
const layerRules = [
  {
    files: ["src/**/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: FRAMEWORKS, message: "Domain code is pure TypeScript." },
            {
              group: ["**/application/**", "**/infrastructure/**", "**/presentation/**"],
              message: "Domain code must not depend on outer layers.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: FRAMEWORKS.filter((name) => name !== "zod"),
              message: "Use cases depend on ports, not on frameworks.",
            },
            {
              group: ["**/infrastructure/**", "**/presentation/**"],
              message: "Use cases must not depend on infrastructure or presentation.",
            },
          ],
        },
      ],
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...layerRules,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "drizzle/**"]),
]);

export default eslintConfig;
