import legacyCompat from "./postcss-legacy-compat.mjs";
import tailwindcss from "@tailwindcss/postcss";
import presetEnv from "postcss-preset-env";

// Pipeline de CSS com downlevel para navegadores antigos.
//
// Tailwind v4 gera CSS que só funciona em Chrome 111+ / Safari 16.4+.
// Em tablets Android com Chrome antigo (< 99) o `@layer` não é reconhecido e
// o navegador descarta TODAS as regras dentro dele — a aplicação abria sem
// nenhum estilo. Aqui achatamos as cascade layers e convertemos oklch()/oklab()
// para rgb(), que é o que faz a página renderizar nesses dispositivos.
//
// O alvo de navegadores vem do campo `browserslist` no package.json.
export default {
  plugins: [
    tailwindcss(),
    // O ponto crítico: sem isso a folha inteira é ignorada no navegador antigo.
    legacyCompat(),
    presetEnv({
      // Sem presets automáticos: habilitamos só o que precisamos, para não
      // reescrever seletores/propriedades que já funcionam.
      stage: false,
      features: {
        // As cores do tema vivem dentro de custom properties
        // (--primary: oklch(...)), onde fallback por dupla declaracao nao
        // funciona — o valor precisa ser substituido de vez.
        "oklab-function": { preserve: false },
      },
      autoprefixer: true,
    }),
    // Nota: `gradient-interpolation-method` NAO e habilitado de proposito —
    // ele trava o build (>7min) no volume de CSS gerado aqui. O `in oklab`
    // dos gradientes e removido em postcss-legacy-compat.mjs.
  ],
};
