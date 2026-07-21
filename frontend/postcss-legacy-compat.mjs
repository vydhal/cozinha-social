// Ajustes no CSS gerado pelo Tailwind v4 para rodar em navegadores antigos.
//
// Contexto: o Tailwind v4 mira Chrome 111+ / Safari 16.4+. Em tablets Android
// com Chrome antigo (< 99) a aplicacao abria completamente sem estilo, porque
// o navegador ignora `@layer` e descarta tudo que esta dentro dele.
const plugin = () => ({
  postcssPlugin: "legacy-browser-compat",
  OnceExit(root) {
    // 1) Achata as cascade layers.
    //
    // Por que nao usar @csstools/postcss-cascade-layers: ele recalcula a
    // especificidade de cada seletor da folha inteira e trava o build (>10min)
    // no volume de CSS gerado aqui.
    //
    // Por que o achatamento simples e seguro neste projeto: o Tailwind emite as
    // layers na mesma ordem em que as declara (theme, base, components,
    // utilities), e as utilities sao sempre seletores de classe unica que vem
    // por ultimo. Removendo so o involucro, a ordem de origem ja produz a mesma
    // precedencia — sem precisar inflar especificidade.
    let found = true;
    while (found) {
      found = false;
      root.walkAtRules("layer", (rule) => {
        found = true;
        if (rule.nodes) {
          rule.replaceWith(rule.nodes);
        } else {
          // Declaracao de ordem: `@layer theme, base, components, utilities;`
          rule.remove();
        }
      });
    }

    // 2) Remove a interpolacao `in oklab` dos gradientes.
    //
    // `linear-gradient(to bottom right in oklab, ...)` e invalido em navegador
    // antigo, e a declaracao inteira e descartada — no /painel isso deixava
    // texto branco sobre fundo transparente. Sem o `in oklab` o gradiente
    // interpola em sRGB, diferenca visual imperceptivel nessas cores.
    root.walkDecls(/^--tw-gradient-position$/, (decl) => {
      decl.value = decl.value.replace(/\s+in\s+oklab\b/g, "");
    });

    // 3) Fallback para unidades de viewport dinamicas (svh/dvh/lvh e variantes
    // de largura), que so existem a partir do Chrome 108 / Safari 15.4.
    //
    // Sem isso, `h-dvh` no AppShell e `min-h-svh` no login viram declaracao
    // invalida e a altura cai para auto, quebrando o layout de coluna. A
    // declaracao equivalente em vh vem antes; navegador moderno usa a de baixo.
    const dynamicViewportUnit = /(\d)(s|l|d)(vh|vw|vmin|vmax)\b/i;
    root.walkDecls((decl) => {
      if (!dynamicViewportUnit.test(decl.value)) return;
      const fallback = decl.value.replace(
        new RegExp(dynamicViewportUnit, "gi"),
        "$1$3",
      );
      if (fallback === decl.value) return;
      decl.cloneBefore({ value: fallback });
    });
  },
});

plugin.postcss = true;

export default plugin;
