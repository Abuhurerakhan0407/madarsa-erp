import { defineConfig } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const source = [...nextVitals, ...nextTypeScript];
const family = process.env.DIAG_ESLINT_FAMILY || "none";

function keepRule(name) {
  if (family === "none") return false;
  if (family === "react") return name.startsWith("react/");
  if (family === "hooks") return name.startsWith("react-hooks/");
  if (family === "next") return name.startsWith("@next/next/");
  if (family === "typescript") return name.startsWith("@typescript-eslint/");
  if (family === "import") return name.startsWith("import/");
  if (family === "a11y") return name.startsWith("jsx-a11y/");
  return true;
}

export default defineConfig(
  source.map((config) => ({
    ...config,
    rules: config.rules
      ? Object.fromEntries(
          Object.entries(config.rules).map(([name, value]) => [name, keepRule(name) ? value : "off"])
        )
      : config.rules
  }))
);
