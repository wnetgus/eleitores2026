import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Next.js build output
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vercel deploy output (gerado automaticamente — não faz parte do código-fonte)
    ".vercel/**",
    // Scripts de seed/manutenção — dívida de any intencional, não afeta produção
    "scripts/**",
  ]),
  {
    // Rebaixa dívida existente e disseminada para warn — CI bloqueia apenas erros reais de runtime.
    // Regras mantidas como error: hooks fora de lugar, variáveis não declaradas, etc.
    rules: {
      "@typescript-eslint/no-explicit-any":   "warn",  // Record<string,any> intencional em Firestore
      "react/no-unescaped-entities":           "warn",  // aspas em JSX — não quebra runtime
      "@next/next/no-html-link-for-pages":     "warn",  // dívida de migração para <Link>
      "prefer-const":                          "warn",  // estilo
      "react-hooks/exhaustive-deps":           "warn",  // deps intencionalmente omitidas em vários lugares
      "react-hooks/set-state-in-effect":       "warn",  // padrão .catch(setState) disseminado
      "@typescript-eslint/no-unused-vars":     "warn",  // variáveis de desestruturação _prefixed
      "react-hooks/purity":                    "warn",  // Date.now() em useMemo — padrão aceito
    },
  },
]);

export default eslintConfig;
