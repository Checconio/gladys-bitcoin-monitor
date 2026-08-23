import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  { ignores: ["coverage/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "error",
    },
  },
  prettier,
];
