import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import prettier from "eslint-config-prettier/flat"
import tailwind from "eslint-plugin-tailwindcss"

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "dist/**",
      ".cache/**",
      "**/*.esm.js",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...tailwind.configs["flat/recommended"],
  {
    settings: {
      tailwindcss: {
        callees: ["cn"],
        config: "tailwind.config.js",
      },
    },
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "react/jsx-key": "off",
      "tailwindcss/no-custom-classname": "off",
      "@next/next/no-sync-scripts": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  prettier,
]

export default config
